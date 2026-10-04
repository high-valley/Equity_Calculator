import { getRemainingCards } from './deck';
import { fastBestScoreOf7, toCardCode } from './fastLookup';
import { RANK_VALUE } from './cards';
import type { Card, EquityResultData, OpponentSlot } from './types';

const SUIT_INDEX: Record<Card['suit'], number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };

function codeOf(card: Card): number {
  return toCardCode(RANK_VALUE[card.rank], SUIT_INDEX[card.suit]);
}

function swap(arr: Int32Array, a: number, b: number): void {
  const t = arr[a];
  arr[a] = arr[b];
  arr[b] = t;
}

export interface EquityComputeInput {
  heroCards: [Card, Card];
  boardCards: Card[];
  /** 1-8 opponents. A 'specific' slot must have exactly 2 cards; a 'random' slot's cards are ignored. */
  opponents: OpponentSlot[];
}

export interface EquityProgress {
  processed: number;
  total: number;
}

/** Advances a sorted k-combination of indices (0..n-1) in place. Returns false when exhausted. */
function nextCombo(indices: Int32Array, n: number, k: number): boolean {
  let i = k - 1;
  while (i >= 0 && indices[i] === n - k + i) i--;
  if (i < 0) return false;
  indices[i]++;
  for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1;
  return true;
}

function countCombinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
  return Math.round(result);
}

/**
 * Total number of showdowns this computation will enumerate. Each random opponent beyond
 * the board multiplies the work by ~C(remaining pool, 2) at that point — one extra random
 * opponent is roughly as expensive as dealing one extra board card, so this grows very
 * fast. Specific opponents (hand fully known) don't add any enumeration, no matter how many.
 */
export function estimateTotalTrials(input: EquityComputeInput): number {
  const missingBoard = 5 - input.boardCards.length;
  const specificCount = input.opponents.filter((o) => o.mode === 'specific').length;
  const randomCount = input.opponents.length - specificCount;
  const poolSize = 52 - input.heroCards.length - input.boardCards.length - specificCount * 2;

  const boardCombos = missingBoard === 0 ? 1 : countCombinations(poolSize, missingBoard);
  let poolAfterBoard = poolSize - missingBoard;
  let perBoardTrials = 1;
  for (let i = 0; i < randomCount; i++) {
    perBoardTrials *= countCombinations(poolAfterBoard, 2);
    poolAfterBoard -= 2;
  }
  return boardCombos * perBoardTrials;
}

/**
 * Exhaustively enumerates every possible showdown consistent with the known cards, against
 * every opponent, and tallies win/tie/lose. A generator so a caller (the Web Worker) can
 * pause to report progress or bail out if the request has gone stale.
 *
 * Board completions are enumerated first (outer loop) so hero's and each *specific* opponent's
 * hand value can be computed once per board and reused across every random-opponent deal
 * sharing that board. Random opponents are then dealt one at a time (inner, recursive): each
 * one picks 2 cards from whatever's left, which is exactly as expensive as dealing one more
 * board card — so N random opponents costs roughly the same as N extra board cards.
 *
 * "Win" means hero's hand is strictly better than every opponent's; "tie" means hero shares
 * the best hand with one or more opponents (equity for that showdown is split 1/(tied count)
 * accordingly, not always halved — that's only correct for exactly two players).
 */
export function* computeEquityGen(input: EquityComputeInput): Generator<EquityProgress, EquityResultData, void> {
  const { heroCards, boardCards, opponents } = input;
  const specificOpponents = opponents.filter((o) => o.mode === 'specific');
  const randomCount = opponents.length - specificOpponents.length;

  // Where each opponent's score ends up in the per-trial `allOppScores` buffer, keyed by
  // its position in `specificBufs`/`randomBufs` — both filters preserve the original
  // opponents order, so these are just "which original slot is the i-th specific/random one".
  const specificOrigIndex: number[] = [];
  const randomOrigIndex: number[] = [];
  opponents.forEach((o, i) => (o.mode === 'specific' ? specificOrigIndex : randomOrigIndex).push(i));

  const usedCards: Card[] = [...heroCards, ...boardCards, ...specificOpponents.flatMap((o) => o.cards)];
  const pool = getRemainingCards(usedCards).map(codeOf);

  const boardKnownCodes = boardCards.map(codeOf);
  const missingBoard = 5 - boardCards.length;

  const heroBuf = new Int32Array(7);
  heroBuf[0] = codeOf(heroCards[0]);
  heroBuf[1] = codeOf(heroCards[1]);

  const specificBufs: Int32Array[] = specificOpponents.map((o) => {
    const buf = new Int32Array(7);
    buf[0] = codeOf(o.cards[0]);
    buf[1] = codeOf(o.cards[1]);
    return buf;
  });

  // One reusable scratch buffer per recursion depth (one per random opponent), so dealing
  // opponents never allocates in the hot path.
  const randomBufs: Int32Array[] = Array.from({ length: randomCount }, () => new Int32Array(7));
  const oppPool = new Int32Array(pool.length);

  // Reused across every trial: holds each opponent's current score (by original opponents
  // index) so a leaf can see everyone at once, not just the best of them.
  const allOppScores = new Int32Array(opponents.length);

  let win = 0;
  let tie = 0;
  let lose = 0;
  let trials = 0;
  let equitySum = 0;
  let sinceYield = 0;

  const oppWin = new Float64Array(opponents.length);
  const oppTie = new Float64Array(opponents.length);
  const oppLose = new Float64Array(opponents.length);
  const oppEquitySum = new Float64Array(opponents.length);

  const total = estimateTotalTrials(input);
  // Yield roughly a few times a second: often enough for live progress and prompt
  // cancellation, rare enough that the per-chunk event-loop handoff stays cheap.
  const CHUNK_TRIALS = 2_000_000;

  function setBoardPortion(buf: Int32Array, completionCodes: Int32Array, completionLen: number): void {
    for (let i = 0; i < boardKnownCodes.length; i++) buf[2 + i] = boardKnownCodes[i];
    for (let i = 0; i < completionLen; i++) buf[2 + boardKnownCodes.length + i] = completionCodes[i];
  }

  // Every player (hero + each opponent) is scored against the same showdown, so a single
  // pass finds the overall best score and how many players share it; whoever's in that top
  // group wins outright (alone) or splits the pot 1/(group size) (tied).
  function tallyLeaf(heroScore: number): void {
    trials++;
    let max = heroScore;
    for (let i = 0; i < allOppScores.length; i++) if (allOppScores[i] > max) max = allOppScores[i];
    let count = heroScore === max ? 1 : 0;
    for (let i = 0; i < allOppScores.length; i++) if (allOppScores[i] === max) count++;

    if (heroScore === max) {
      if (count === 1) {
        win++;
        equitySum += 1;
      } else {
        tie++;
        equitySum += 1 / count;
      }
    } else {
      lose++;
    }

    for (let i = 0; i < allOppScores.length; i++) {
      if (allOppScores[i] === max) {
        if (count === 1) {
          oppWin[i]++;
          oppEquitySum[i] += 1;
        } else {
          oppTie[i]++;
          oppEquitySum[i] += 1 / count;
        }
      } else {
        oppLose[i]++;
      }
    }
  }

  function* dealRandomOpponents(poolLen: number, depth: number, heroScore: number): Generator<EquityProgress, void, void> {
    if (depth === randomCount) {
      tallyLeaf(heroScore);
      sinceYield++;
      if (sinceYield >= CHUNK_TRIALS) {
        sinceYield = 0;
        yield { processed: trials, total };
      }
      return;
    }
    const buf = randomBufs[depth];
    const origIndex = randomOrigIndex[depth];
    for (let i = 0; i < poolLen; i++) {
      for (let j = i + 1; j < poolLen; j++) {
        buf[0] = oppPool[i];
        buf[1] = oppPool[j];
        allOppScores[origIndex] = fastBestScoreOf7(buf);

        // Remove i and j (swap-to-end, largest index first so the second removal's
        // "last slot" index is still valid); each swap is its own inverse, so undoing
        // after the recursive call is just redoing the same two swaps in reverse order.
        swap(oppPool, j, poolLen - 1);
        swap(oppPool, i, poolLen - 2);

        yield* dealRandomOpponents(poolLen - 2, depth + 1, heroScore);

        swap(oppPool, i, poolLen - 2);
        swap(oppPool, j, poolLen - 1);
      }
    }
  }

  function* processBoardComplete(
    boardIndices: Int32Array,
    completionCodes: Int32Array,
    completionLen: number,
  ): Generator<EquityProgress, void, void> {
    setBoardPortion(heroBuf, completionCodes, completionLen);
    const heroScore = fastBestScoreOf7(heroBuf);

    for (let i = 0; i < specificBufs.length; i++) {
      setBoardPortion(specificBufs[i], completionCodes, completionLen);
      allOppScores[specificOrigIndex[i]] = fastBestScoreOf7(specificBufs[i]);
    }

    if (randomCount === 0) {
      tallyLeaf(heroScore);
      sinceYield++;
      if (sinceYield >= CHUNK_TRIALS) {
        sinceYield = 0;
        yield { processed: trials, total };
      }
      return;
    }

    for (const buf of randomBufs) setBoardPortion(buf, completionCodes, completionLen);

    let oppPoolLen = 0;
    let ci = 0;
    for (let i = 0; i < pool.length; i++) {
      if (ci < completionLen && boardIndices[ci] === i) {
        ci++;
        continue;
      }
      oppPool[oppPoolLen++] = pool[i];
    }

    yield* dealRandomOpponents(oppPoolLen, 0, heroScore);
  }

  const n = pool.length;
  const k = missingBoard;
  const indices = new Int32Array(k);
  for (let i = 0; i < k; i++) indices[i] = i;
  const completionCodes = new Int32Array(k);

  let hasMore = true;
  while (hasMore) {
    for (let i = 0; i < k; i++) completionCodes[i] = pool[indices[i]];
    yield* processBoardComplete(indices, completionCodes, k);
    hasMore = nextCombo(indices, n, k);
  }
  yield { processed: trials, total };

  return {
    winPct: (win / trials) * 100,
    tiePct: (tie / trials) * 100,
    losePct: (lose / trials) * 100,
    equityPct: (equitySum / trials) * 100,
    trials,
    opponentResults: Array.from({ length: opponents.length }, (_, i) => ({
      winPct: (oppWin[i] / trials) * 100,
      tiePct: (oppTie[i] / trials) * 100,
      losePct: (oppLose[i] / trials) * 100,
      equityPct: (oppEquitySum[i] / trials) * 100,
    })),
  };
}

/** Runs the generator to completion synchronously. Fine for the fast phases; the worker
 * uses the generator form directly for slow cases so it can report progress and support
 * cancellation. */
export function computeEquitySync(input: EquityComputeInput): EquityResultData {
  const gen = computeEquityGen(input);
  let result = gen.next();
  while (!result.done) {
    result = gen.next();
  }
  return result.value;
}
