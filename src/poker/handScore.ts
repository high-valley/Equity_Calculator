import { HandCategory } from './types';
import { combinations } from './combinations';

/**
 * Fast, allocation-light hand scoring used by the equity engine's hot loop.
 * Cards are represented as plain numbers here (rank 2..14, suit 0..3) rather
 * than Card objects, since this code runs many millions of times during
 * exhaustive enumeration and object/array allocation dominates otherwise.
 *
 * `evaluator.ts` builds the user-facing HandValue on top of this same scoring
 * function, so there is exactly one place that knows what beats what.
 */

const KICKER_BASE = 15; // ranks are 2..14, so base-15 digits are always unambiguous

/** Precomputed C(n,5) index combinations for n = 5, 6, 7 (the only sizes we ever score). */
const COMBO_INDICES: Map<number, number[][]> = new Map(
  [5, 6, 7].map((n) => [n, Array.from(combinations(Array.from({ length: n }, (_, i) => i), 5))]),
);

// Bitmask windows for the 9 "normal" straights (6-high .. Ace-high) plus the wheel (5-high).
// Bit (r-2) represents rank r, for r in 2..14. Stored as flat typed arrays (indexed loop,
// no per-call iterator/object allocation) since this runs in the hottest of hot paths.
const STRAIGHT_MASKS = new Int32Array(9);
const STRAIGHT_HIGHS = new Int32Array(9);
for (let start = 8; start >= 0; start--) {
  const i = 8 - start;
  STRAIGHT_MASKS[i] = 0b11111 << start;
  STRAIGHT_HIGHS[i] = start + 6;
}
const WHEEL_MASK = 0b1111 | (1 << 12); // ranks 2,3,4,5,A
const WHEEL_HIGH = 5;

// Reused scratch buffers to avoid per-call allocation in the hot path.
const rankCountScratch = new Int8Array(15);
const comboRanks = new Int32Array(5);
const comboSuits = new Int32Array(5);
const sortScratch = new Int32Array(5);

/** Sorts 5 numbers descending in-place into `sortScratch` (no allocation). Small insertion sort. */
function sortDesc5(a: number, b: number, c: number, d: number, e: number): Int32Array {
  sortScratch[0] = a;
  sortScratch[1] = b;
  sortScratch[2] = c;
  sortScratch[3] = d;
  sortScratch[4] = e;
  for (let i = 1; i < 5; i++) {
    const key = sortScratch[i];
    let j = i - 1;
    while (j >= 0 && sortScratch[j] < key) {
      sortScratch[j + 1] = sortScratch[j];
      j--;
    }
    sortScratch[j + 1] = key;
  }
  return sortScratch;
}

/** Flat C(7,5) index combinations (21 combos x 5 indices), precomputed for the equity hot loop. */
const COMBO7_FLAT: Int8Array = (() => {
  const combos = Array.from(combinations([0, 1, 2, 3, 4, 5, 6], 5));
  const flat = new Int8Array(combos.length * 5);
  combos.forEach((combo, ci) => combo.forEach((v, i) => (flat[ci * 5 + i] = v)));
  return flat;
})();
const COMBO7_COUNT = COMBO7_FLAT.length / 5;
const combo7Ranks = new Int32Array(5);
const combo7Suits = new Int32Array(5);

function encodeScore(category: HandCategory, k0: number, k1: number, k2: number, k3: number, k4: number): number {
  return (
    (((((category * KICKER_BASE + k0) * KICKER_BASE + k1) * KICKER_BASE + k2) * KICKER_BASE + k3) * KICKER_BASE +
      k4)
  );
}

export interface DecodedScore {
  category: HandCategory;
  kickers: number[];
}

export function decodeScore(score: number): DecodedScore {
  const k4 = score % KICKER_BASE;
  let rest = Math.floor(score / KICKER_BASE);
  const k3 = rest % KICKER_BASE;
  rest = Math.floor(rest / KICKER_BASE);
  const k2 = rest % KICKER_BASE;
  rest = Math.floor(rest / KICKER_BASE);
  const k1 = rest % KICKER_BASE;
  rest = Math.floor(rest / KICKER_BASE);
  const k0 = rest % KICKER_BASE;
  const category = Math.floor(rest / KICKER_BASE) as HandCategory;

  const kickerCount = KICKERS_USED[category];
  const all = [k0, k1, k2, k3, k4];
  return { category, kickers: all.slice(0, kickerCount) };
}

const KICKERS_USED: Record<HandCategory, number> = {
  [HandCategory.HighCard]: 5,
  [HandCategory.OnePair]: 4,
  [HandCategory.TwoPair]: 3,
  [HandCategory.ThreeOfAKind]: 3,
  [HandCategory.Straight]: 1,
  [HandCategory.Flush]: 5,
  [HandCategory.FullHouse]: 2,
  [HandCategory.FourOfAKind]: 2,
  [HandCategory.StraightFlush]: 1,
};

/** Scores exactly 5 cards (ranks 2..14, suits 0..3). Higher score = stronger hand. */
export function score5(ranks: Int32Array | number[], suits: Int32Array | number[]): number {
  const r0 = ranks[0];
  const r1 = ranks[1];
  const r2 = ranks[2];
  const r3 = ranks[3];
  const r4 = ranks[4];

  const isFlush = suits[0] === suits[1] && suits[1] === suits[2] && suits[2] === suits[3] && suits[3] === suits[4];

  const rankMask = (1 << (r0 - 2)) | (1 << (r1 - 2)) | (1 << (r2 - 2)) | (1 << (r3 - 2)) | (1 << (r4 - 2));
  let straightHigh = 0;
  // Only possible when there are 5 distinct ranks; the mask checks below already
  // require 5 specific bits, which can't all be set if there are duplicate ranks.
  for (let i = 0; i < 9; i++) {
    const mask = STRAIGHT_MASKS[i];
    if ((rankMask & mask) === mask) {
      straightHigh = STRAIGHT_HIGHS[i];
      break;
    }
  }
  if (straightHigh === 0 && (rankMask & WHEEL_MASK) === WHEEL_MASK) {
    straightHigh = WHEEL_HIGH;
  }

  if (isFlush && straightHigh > 0) {
    return encodeScore(HandCategory.StraightFlush, straightHigh, 0, 0, 0, 0);
  }

  rankCountScratch[r0]++;
  rankCountScratch[r1]++;
  rankCountScratch[r2]++;
  rankCountScratch[r3]++;
  rankCountScratch[r4]++;

  let quadRank = 0;
  let tripRank = 0;
  let pairHi = 0;
  let pairLo = 0;
  let singleHi = 0;
  let singleMid = 0;
  let singleLo = 0;

  for (let r = 14; r >= 2; r--) {
    const c = rankCountScratch[r];
    if (c === 4) quadRank = r;
    else if (c === 3) tripRank = r;
    else if (c === 2) {
      if (pairHi === 0) pairHi = r;
      else pairLo = r;
    } else if (c === 1) {
      if (singleHi === 0) singleHi = r;
      else if (singleMid === 0) singleMid = r;
      else singleLo = r;
    }
  }

  rankCountScratch[r0] = 0;
  rankCountScratch[r1] = 0;
  rankCountScratch[r2] = 0;
  rankCountScratch[r3] = 0;
  rankCountScratch[r4] = 0;

  if (quadRank > 0) {
    const kicker = tripRank || pairHi || singleHi;
    return encodeScore(HandCategory.FourOfAKind, quadRank, kicker, 0, 0, 0);
  }
  if (tripRank > 0 && pairHi > 0) {
    return encodeScore(HandCategory.FullHouse, tripRank, pairHi, 0, 0, 0);
  }
  if (isFlush) {
    const desc = sortDesc5(r0, r1, r2, r3, r4);
    return encodeScore(HandCategory.Flush, desc[0], desc[1], desc[2], desc[3], desc[4]);
  }
  if (straightHigh > 0) {
    return encodeScore(HandCategory.Straight, straightHigh, 0, 0, 0, 0);
  }
  if (tripRank > 0) {
    return encodeScore(HandCategory.ThreeOfAKind, tripRank, singleHi, singleMid, 0, 0);
  }
  if (pairHi > 0 && pairLo > 0) {
    return encodeScore(HandCategory.TwoPair, pairHi, pairLo, singleHi, 0, 0);
  }
  if (pairHi > 0) {
    return encodeScore(HandCategory.OnePair, pairHi, singleHi, singleMid, singleLo, 0);
  }
  const desc = sortDesc5(r0, r1, r2, r3, r4);
  return encodeScore(HandCategory.HighCard, desc[0], desc[1], desc[2], desc[3], desc[4]);
}

/** Best 5-card score achievable from n (5, 6 or 7) cards. Used by the equity hot loop. */
export function bestScoreOfN(ranks: number[], suits: number[]): number {
  const n = ranks.length;
  if (n === 5) return score5(ranks, suits);
  const combos = COMBO_INDICES.get(n);
  if (!combos) throw new Error(`Unsupported hand size: ${n}`);

  let best = -1;
  for (const combo of combos) {
    for (let i = 0; i < 5; i++) {
      comboRanks[i] = ranks[combo[i]];
      comboSuits[i] = suits[combo[i]];
    }
    const s = score5(comboRanks, comboSuits);
    if (s > best) best = s;
  }
  return best;
}

/**
 * Best 5-card score from exactly 7 cards. This is the equity engine's hottest path
 * (every showdown enumerated is 2 hole + 5 board cards), so it avoids the generic
 * Map lookup and per-call array allocation that `bestScoreOfN` uses.
 */
export function bestScoreOf7(ranks: number[] | Int32Array, suits: number[] | Int32Array): number {
  let best = -1;
  for (let ci = 0; ci < COMBO7_COUNT; ci++) {
    const base = ci * 5;
    for (let i = 0; i < 5; i++) {
      const idx = COMBO7_FLAT[base + i];
      combo7Ranks[i] = ranks[idx];
      combo7Suits[i] = suits[idx];
    }
    const s = score5(combo7Ranks, combo7Suits);
    if (s > best) best = s;
  }
  return best;
}

/** Same as bestScoreOfN but also returns which combination of indices produced it (for display). */
export function bestComboOfN(ranks: number[], suits: number[]): { score: number; indices: number[] } {
  const n = ranks.length;
  const combos = COMBO_INDICES.get(n) ?? [[0, 1, 2, 3, 4]];
  let best = -1;
  let bestIndices = combos[0];
  for (const combo of combos) {
    const r = combo.map((i) => ranks[i]);
    const s = combo.map((i) => suits[i]);
    const score = score5(r, s);
    if (score > best) {
      best = score;
      bestIndices = combo;
    }
  }
  return { score: best, indices: bestIndices };
}
