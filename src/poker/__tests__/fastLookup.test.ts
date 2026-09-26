import { describe, it, expect } from 'vitest';
import { bestScoreOfN } from '../handScore';
import { toCardCode, fastBestScoreOf7 } from '../fastLookup';

/**
 * The equity engine's hot loop uses fastBestScoreOf7 (an O(1) lookup-table evaluator)
 * for speed. Its tables are generated from `score5`/`bestScoreOfN` (the straightforward,
 * easy-to-verify reference implementation), but we still cross-check the two agree on
 * a large sample of random 7-card hands as a guard against a table-generation bug.
 */
describe('fastBestScoreOf7 vs reference evaluator', () => {
  it('agrees with bestScoreOfN on many random 7-card hands', () => {
    const SUITS = [0, 1, 2, 3];
    for (let trial = 0; trial < 20000; trial++) {
      const ranks: number[] = [];
      const suits: number[] = [];
      const codes = new Int32Array(7);
      const usedIds = new Set<string>();
      for (let i = 0; i < 7; i++) {
        let r = 0;
        let s = 0;
        let id = '';
        do {
          r = 2 + Math.floor(Math.random() * 13);
          s = SUITS[Math.floor(Math.random() * 4)];
          id = `${r}_${s}`;
        } while (usedIds.has(id));
        usedIds.add(id);
        ranks.push(r);
        suits.push(s);
        codes[i] = toCardCode(r, s);
      }
      expect(fastBestScoreOf7(codes)).toBe(bestScoreOfN(ranks, suits));
    }
  });
});
