import { RANK_VALUE } from './cards';
import { getRemainingCards } from './deck';
import type { Card, DrawInfo, Suit } from './types';

// The 10 possible 5-rank straight windows (wheel first), as rank values 2..14.
const STRAIGHT_WINDOWS: number[][] = [
  [14, 2, 3, 4, 5], // wheel (A-2-3-4-5)
  ...Array.from({ length: 9 }, (_, i) => {
    const low = i + 6; // 6-high .. Ace-high
    return [low, low - 1, low - 2, low - 3, low - 4];
  }),
];

/**
 * Detects flush/straight draws and counts outs (cards that complete either draw).
 * Only meaningful with 5 or 6 known cards (flop or turn); preflop has no draw yet
 * and river has no more cards to come, so both return "no draw".
 */
export function analyzeDraws(heroCards: Card[], boardCards: Card[]): DrawInfo {
  const combined = [...heroCards, ...boardCards];
  if (combined.length < 5 || combined.length >= 7) {
    return { flushDraw: false, straightDraw: false, outs: 0 };
  }

  const suitCounts: Record<Suit, number> = { spades: 0, hearts: 0, diamonds: 0, clubs: 0 };
  for (const card of combined) suitCounts[card.suit]++;
  const flushSuit = (Object.keys(suitCounts) as Suit[]).find((s) => suitCounts[s] === 4);

  const rankSet = new Set(combined.map((c) => RANK_VALUE[c.rank]));
  const completingRanks = new Set<number>();
  for (const window of STRAIGHT_WINDOWS) {
    const missing = window.filter((r) => !rankSet.has(r));
    if (missing.length === 1) completingRanks.add(missing[0]);
  }

  const remaining = getRemainingCards(combined);
  const outCardIds = new Set<string>();
  for (const card of remaining) {
    const rankValue = RANK_VALUE[card.rank];
    if ((flushSuit && card.suit === flushSuit) || completingRanks.has(rankValue)) {
      outCardIds.add(card.id);
    }
  }

  return {
    flushDraw: Boolean(flushSuit),
    straightDraw: completingRanks.size > 0,
    outs: outCardIds.size,
  };
}
