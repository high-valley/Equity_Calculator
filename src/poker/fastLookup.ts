import { combinations } from './combinations';
import { score5 } from './handScore';

/**
 * O(1)-lookup hand scoring (Cactus Kev-style: prime-product + rank-bitmask perfect hash).
 *
 * The equity engine's exhaustive enumeration needs to score hundreds of millions of
 * 5-card hands. `score5` (handScore.ts) is correct but does real branching work per
 * call; that's fine for evaluator.ts's one-off "Current Hand" display, but far too
 * slow for the enumeration hot loop.
 *
 * Every reachable 5-card hand falls into exactly one of 7462 distinct hand ranks.
 * We precompute a table from a hand's "signature" to its score, using `score5` itself
 * as the ground truth, so the fast path can never disagree with the correct one.
 *   - Hands with 5 distinct ranks (straights / flushes / high card): the signature is
 *     a 13-bit rank-presence bitmask, used as a direct array index (two tables: one
 *     for flush, one for non-flush, since the same rank pattern scores differently).
 *   - Hands with a repeated rank (pairs / trips / quads / full house): 5 distinct
 *     ranks are impossible with a flush (a suit has only one card per rank), so these
 *     are always non-flush. The signature is the product of each card's rank-prime,
 *     which is a unique multiset identifier by the fundamental theorem of arithmetic.
 */

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41]; // one per rank, 2..A
const RANK_VALUES = Array.from({ length: 13 }, (_, i) => i + 2); // 2..14

function primeOf(rank: number): number {
  return PRIMES[rank - 2];
}

/**
 * Encodes a card as a 32-bit int:
 *   bits 0-7:   rank prime (2..41)
 *   bits 8-11:  rank index (0..12)
 *   bits 12-15: suit one-hot bit
 *   bits 16-28: rank one-hot bit (for OR-ing across a hand into a 13-bit presence mask)
 */
export function toCardCode(rank: number, suit: number): number {
  const idx = rank - 2;
  return primeOf(rank) | (idx << 8) | (1 << (12 + suit)) | (1 << (16 + idx));
}

const RANK_KEY_SIZE = 1 << 13;
const flushTable = new Int32Array(RANK_KEY_SIZE).fill(-1);
const uniqueTable = new Int32Array(RANK_KEY_SIZE).fill(-1);
const productTable = new Map<number, number>();
const popcount13 = new Uint8Array(RANK_KEY_SIZE);
for (let i = 0; i < RANK_KEY_SIZE; i++) {
  popcount13[i] = (i & 1) + popcount13[i >>> 1];
}

function rankKeyOf(ranks: number[]): number {
  let key = 0;
  for (const r of ranks) key |= 1 << (r - 2);
  return key;
}

// 5-distinct-rank patterns: straight/flush and straight/high-card tables.
for (const combo of combinations(RANK_VALUES, 5)) {
  const key = rankKeyOf(combo);
  flushTable[key] = score5(combo, [0, 0, 0, 0, 0]);
  uniqueTable[key] = score5(combo, [0, 0, 0, 0, 1]);
}

function setProduct(ranks: number[], suits: number[]): void {
  const product = ranks.reduce((p, r) => p * primeOf(r), 1);
  productTable.set(product, score5(ranks, suits));
}

// Four of a kind.
for (const quad of RANK_VALUES) {
  for (const kicker of RANK_VALUES) {
    if (kicker === quad) continue;
    setProduct([quad, quad, quad, quad, kicker], [0, 1, 2, 3, 0]);
  }
}

// Full house.
for (const trip of RANK_VALUES) {
  for (const pair of RANK_VALUES) {
    if (pair === trip) continue;
    setProduct([trip, trip, trip, pair, pair], [0, 1, 2, 0, 1]);
  }
}

// Three of a kind + 2 distinct kickers.
for (const trip of RANK_VALUES) {
  const others = RANK_VALUES.filter((r) => r !== trip);
  for (const [k1, k2] of combinations(others, 2)) {
    setProduct([trip, trip, trip, k1, k2], [0, 1, 2, 0, 0]);
  }
}

// Two pair + kicker.
for (const [p1, p2] of combinations(RANK_VALUES, 2)) {
  const others = RANK_VALUES.filter((r) => r !== p1 && r !== p2);
  for (const kicker of others) {
    setProduct([p1, p1, p2, p2, kicker], [0, 1, 0, 1, 0]);
  }
}

// One pair + 3 distinct kickers.
for (const pair of RANK_VALUES) {
  const others = RANK_VALUES.filter((r) => r !== pair);
  for (const [k1, k2, k3] of combinations(others, 3)) {
    setProduct([pair, pair, k1, k2, k3], [0, 1, 0, 0, 0]);
  }
}

/** Scores exactly 5 encoded cards in O(1). Higher score = stronger hand. */
export function fastScore5(c0: number, c1: number, c2: number, c3: number, c4: number): number {
  const suitAnd = c0 & c1 & c2 & c3 & c4 & 0xf000;
  const rankKey = (c0 | c1 | c2 | c3 | c4) >>> 16;

  if (suitAnd !== 0) return flushTable[rankKey];
  if (popcount13[rankKey] === 5) return uniqueTable[rankKey];

  const product = (c0 & 0xff) * (c1 & 0xff) * (c2 & 0xff) * (c3 & 0xff) * (c4 & 0xff);
  const score = productTable.get(product);
  if (score === undefined) throw new Error(`No table entry for product ${product}`);
  return score;
}

/** Flat C(7,5) index combinations (21 x 5), precomputed for the equity hot loop. */
const COMBO7_FLAT: Uint8Array = (() => {
  const combos = Array.from(combinations([0, 1, 2, 3, 4, 5, 6], 5));
  const flat = new Uint8Array(combos.length * 5);
  combos.forEach((combo, ci) => combo.forEach((v, i) => (flat[ci * 5 + i] = v)));
  return flat;
})();
const COMBO7_COUNT = COMBO7_FLAT.length / 5;

/** Best 5-card score from exactly 7 encoded cards. The equity engine's hottest path. */
export function fastBestScoreOf7(codes: Int32Array | number[]): number {
  let best = -1;
  for (let ci = 0; ci < COMBO7_COUNT; ci++) {
    const base = ci * 5;
    const s = fastScore5(
      codes[COMBO7_FLAT[base]],
      codes[COMBO7_FLAT[base + 1]],
      codes[COMBO7_FLAT[base + 2]],
      codes[COMBO7_FLAT[base + 3]],
      codes[COMBO7_FLAT[base + 4]],
    );
    if (s > best) best = s;
  }
  return best;
}
