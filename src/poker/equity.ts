import { getRemainingCards } from './deck';
import { fastBestScoreOf7, toCardCode } from './fastLookup';
import { RANK_VALUE } from './cards';
import type { Card, EquityResultData, OpponentSpec } from './types';

const SUIT_INDEX: Record<Card['suit'], number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };

function codeOf(card: Card): number {
  return toCardCode(RANK_VALUE[card.rank], SUIT_INDEX[card.suit]);
}

export interface EquityComputeInput {
  heroCards: [Card, Card];
  boardCards: Card[];
  opponent: OpponentSpec;
}

export interface EquityProgress {
  processedOuter: number;
  totalOuter: number;
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

/** How many outer (board-completion) steps this computation will take. Used to size progress chunks. */
export function estimateOuterSteps(input: EquityComputeInput): number {
  const missingBoard = 5 - input.boardCards.length;
  const poolSize = 52 - input.heroCards.length - input.boardCards.length - (input.opponent.mode === 'specific' ? input.opponent.cards.length : 0);
  return missingBoard === 0 ? 1 : countCombinations(poolSize, missingBoard);
}

/**
 * Exhaustively enumerates every possible showdown consistent with the known cards, and
 * tallies win/tie/lose. This is a generator so a caller (the Web Worker) can pause between
 * board-completion steps to report progress or to bail out if the request has gone stale.
 *
 * Board completions are enumerated first (outer loop) so a hero's hand value can be computed
 * once per board and reused for every opponent hand sharing that board — the dominant cost
 * for a random opponent is the opponent-side evaluation, which has no equivalent shortcut.
 */
export function* computeEquityGen(
  input: EquityComputeInput,
): Generator<EquityProgress, EquityResultData, void> {
  const { heroCards, boardCards, opponent } = input;

  const usedCards: Card[] = [...heroCards, ...boardCards, ...(opponent.mode === 'specific' ? opponent.cards : [])];
  const pool = getRemainingCards(usedCards).map(codeOf);

  const boardKnownCodes = boardCards.map(codeOf);
  const missingBoard = 5 - boardCards.length;

  const heroBuf = new Int32Array(7);
  heroBuf[0] = codeOf(heroCards[0]);
  heroBuf[1] = codeOf(heroCards[1]);
  for (let i = 0; i < boardKnownCodes.length; i++) heroBuf[2 + i] = boardKnownCodes[i];

  const oppBuf = new Int32Array(7);
  for (let i = 0; i < boardKnownCodes.length; i++) oppBuf[2 + i] = boardKnownCodes[i];
  const isSpecific = opponent.mode === 'specific';
  if (isSpecific) {
    oppBuf[0] = codeOf(opponent.cards[0]);
    oppBuf[1] = codeOf(opponent.cards[1]);
  }

  let win = 0;
  let tie = 0;
  let lose = 0;
  let trials = 0;
  const remainingScratch = new Array<number>(pool.length);

  const totalOuter = missingBoard === 0 ? 1 : countCombinations(pool.length, missingBoard);
  // Chunk size trades progress-update/cancellation granularity against per-chunk overhead
  // (the worker yields to the event loop once per chunk). 2000 keeps that overhead small
  // even for the ~2.1M-step preflop-vs-random case while still updating a few times/sec.
  const CHUNK_SIZE = 2000;

  function tallyOneOpponent(heroScore: number, oppCode0: number, oppCode1: number): void {
    oppBuf[0] = oppCode0;
    oppBuf[1] = oppCode1;
    const oppScore = fastBestScoreOf7(oppBuf);
    trials++;
    if (heroScore > oppScore) win++;
    else if (heroScore === oppScore) tie++;
    else lose++;
  }

  // Board portion of oppBuf is kept in sync with heroBuf's by the caller before this runs.
  function processBoardComplete(): void {
    const heroScore = fastBestScoreOf7(heroBuf);
    if (isSpecific) {
      const oppScore = fastBestScoreOf7(oppBuf);
      trials++;
      if (heroScore > oppScore) win++;
      else if (heroScore === oppScore) tie++;
      else lose++;
      return;
    }
    const remLen = remainingScratch.length; // set by caller before invoking
    for (let i = 0; i < remLen; i++) {
      for (let j = i + 1; j < remLen; j++) {
        tallyOneOpponent(heroScore, remainingScratch[i], remainingScratch[j]);
      }
    }
  }

  if (missingBoard === 0) {
    remainingScratch.length = pool.length;
    for (let i = 0; i < pool.length; i++) remainingScratch[i] = pool[i];
    processBoardComplete();
    yield { processedOuter: 1, totalOuter: 1 };
  } else {
    const n = pool.length;
    const k = missingBoard;
    const indices = new Int32Array(k);
    for (let i = 0; i < k; i++) indices[i] = i;

    let processed = 0;
    let hasMore = true;
    while (hasMore) {
      for (let i = 0; i < k; i++) {
        const code = pool[indices[i]];
        heroBuf[2 + boardKnownCodes.length + i] = code;
        oppBuf[2 + boardKnownCodes.length + i] = code;
      }

      if (!isSpecific) {
        let remLen = 0;
        let ci = 0;
        for (let i = 0; i < n; i++) {
          if (ci < k && indices[ci] === i) {
            ci++;
            continue;
          }
          remainingScratch[remLen++] = pool[i];
        }
        remainingScratch.length = remLen;
      }

      processBoardComplete();

      processed++;
      if (processed % CHUNK_SIZE === 0) {
        yield { processedOuter: processed, totalOuter };
      }

      hasMore = nextCombo(indices, n, k);
    }
    yield { processedOuter: processed, totalOuter };
  }

  const equityPct = ((win + tie * 0.5) / trials) * 100;
  return {
    winPct: (win / trials) * 100,
    tiePct: (tie / trials) * 100,
    losePct: (lose / trials) * 100,
    equityPct,
    trials,
  };
}

/** Runs the generator to completion synchronously. Fine for the fast phases; the worker
 * uses the generator form directly for the slow (preflop, random opponent) case so it can
 * report progress and support cancellation. */
export function computeEquitySync(input: EquityComputeInput): EquityResultData {
  const gen = computeEquityGen(input);
  let result = gen.next();
  while (!result.done) {
    result = gen.next();
  }
  return result.value;
}
