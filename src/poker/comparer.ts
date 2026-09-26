import type { HandValue } from './types';

/**
 * Compares two hand values. Returns > 0 if a beats b, < 0 if b beats a, 0 on a tie.
 * Category is compared first, then kickers left-to-right (missing kicker = 0).
 */
export function compareHands(a: HandValue, b: HandValue): number {
  if (a.category !== b.category) return a.category - b.category;
  const len = Math.max(a.kickers.length, b.kickers.length);
  for (let i = 0; i < len; i++) {
    const av = a.kickers[i] ?? 0;
    const bv = b.kickers[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}
