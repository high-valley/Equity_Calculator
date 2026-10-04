import { describe, it, expect } from 'vitest';
import { computeEquitySync, estimateTotalTrials } from '../equity';
import { cards } from './testHelpers';
import type { Card } from '../types';

describe('computeEquitySync', () => {
  it('AA vs KK preflop (specific opponent): AA is a big favorite, win+tie+lose sum to 100%', () => {
    const [heroCards] = [cards(['As', 'Ah'])];
    const result = computeEquitySync({
      heroCards: [heroCards[0], heroCards[1]],
      boardCards: [],
      opponents: [{ mode: 'specific', cards: cards(['Kd', 'Kc']) }],
    });
    expect(result.trials).toBe(1712304); // C(48,5): all possible boards
    expect(result.winPct + result.tiePct + result.losePct).toBeCloseTo(100, 5);
    // AA vs KK is a well-known ~4-to-1 preflop favorite.
    expect(result.equityPct).toBeGreaterThan(78);
    expect(result.equityPct).toBeLessThan(86);
  });

  it('AKs vs QQ preflop is close to a coin flip, slightly favoring QQ', () => {
    const result = computeEquitySync({
      heroCards: [cards(['As'])[0], cards(['Ks'])[0]],
      boardCards: [],
      opponents: [{ mode: 'specific', cards: cards(['Qh', 'Qc']) }],
    });
    expect(result.equityPct).toBeGreaterThan(40);
    expect(result.equityPct).toBeLessThan(50);
  });

  it('a made flush on the river crushes a random opponent', () => {
    const result = computeEquitySync({
      heroCards: [cards(['As'])[0], cards(['Ks'])[0]],
      boardCards: cards(['2s', '5s', '9s', '4h', '7d']),
      opponents: [{ mode: 'random', cards: [] }],
    });
    expect(result.trials).toBe(990); // C(45,2)
    expect(result.equityPct).toBeGreaterThan(90);
  });

  it('a set on the turn is a strong favorite vs random with the right trial count', () => {
    const result = computeEquitySync({
      heroCards: [cards(['7s'])[0], cards(['7h'])[0]],
      boardCards: cards(['7d', '2c', '9h', 'Ks']),
      opponents: [{ mode: 'random', cards: [] }],
    });
    expect(result.trials).toBe(45540); // C(46,2) * 44
    expect(result.equityPct).toBeGreaterThan(85);
  });

  it('flop equity vs random opponent enumerates every turn/river/opponent combo exactly', () => {
    const result = computeEquitySync({
      heroCards: [cards(['As'])[0], cards(['Ks'])[0]],
      boardCards: cards(['Kd', '7c', '2h']),
      opponents: [{ mode: 'random', cards: [] }],
    });
    expect(result.trials).toBe(1070190); // C(47,2) * C(45,2)
    expect(result.winPct + result.tiePct + result.losePct).toBeCloseTo(100, 5);
  });

  it('a fully determined river hand resolves deterministically', () => {
    const result = computeEquitySync({
      heroCards: [cards(['As'])[0], cards(['Ks'])[0]],
      boardCards: cards(['Ad', 'Kd', 'Qd', 'Jd', '2c']),
      opponents: [{ mode: 'specific', cards: cards(['2s', '3s']) }],
    });
    expect(result.trials).toBe(1);
    expect(result.winPct).toBe(100);
    expect(result.tiePct).toBe(0);
    expect(result.losePct).toBe(0);
  });

  describe('multiple opponents', () => {
    // A royal flush sitting entirely on the board means every player — hero and every
    // opponent, however many, random or specific — ties for the best possible hand no
    // matter what hole cards they hold. That makes the exact win/tie/equity split fully
    // predictable, which is otherwise hard to hand-verify for a 3+-way pot.
    const royalFlushBoard = cards(['Ts', 'Js', 'Qs', 'Ks', 'As']);
    const hero: [Card, Card] = [cards(['2h'])[0], cards(['3h'])[0]];

    it('2-way: hero ties a single specific opponent and splits the pot evenly', () => {
      const result = computeEquitySync({
        heroCards: hero,
        boardCards: royalFlushBoard,
        opponents: [{ mode: 'specific', cards: cards(['2c', '3c']) }],
      });
      expect(result.trials).toBe(1);
      expect(result.tiePct).toBe(100);
      expect(result.equityPct).toBeCloseTo(50, 10);
    });

    it('3-way: hero ties two specific opponents and splits the pot three ways, not in half', () => {
      const result = computeEquitySync({
        heroCards: hero,
        boardCards: royalFlushBoard,
        opponents: [
          { mode: 'specific', cards: cards(['2c', '3c']) },
          { mode: 'specific', cards: cards(['2d', '3d']) },
        ],
      });
      expect(result.trials).toBe(1);
      expect(result.tiePct).toBe(100);
      expect(result.equityPct).toBeCloseTo(100 / 3, 10);
    });

    it('3-way with a random opponent: every possible random hand still ties, splitting three ways', () => {
      const result = computeEquitySync({
        heroCards: hero,
        boardCards: royalFlushBoard,
        opponents: [{ mode: 'specific', cards: cards(['2c', '3c']) }, { mode: 'random', cards: [] }],
      });
      expect(result.trials).toBe(903); // C(43,2): 52 - board(5) - hero(2) - specific opp(2)
      expect(result.tiePct).toBe(100);
      expect(result.equityPct).toBeCloseTo(100 / 3, 10);
    });

    it('hero with quads beats two weaker opponents outright (no ties)', () => {
      const result = computeEquitySync({
        heroCards: [cards(['As'])[0], cards(['Ah'])[0]],
        boardCards: cards(['Ad', 'Ac', '7h', '2c', '3d']),
        opponents: [
          { mode: 'specific', cards: cards(['Kd', 'Kc']) },
          { mode: 'specific', cards: cards(['Qd', 'Qc']) },
        ],
      });
      expect(result.trials).toBe(1);
      expect(result.winPct).toBe(100);
      expect(result.equityPct).toBe(100);
    });

    it('2 random opponents at the river still enumerates exactly and sums to 100%', () => {
      const result = computeEquitySync({
        heroCards: [cards(['As'])[0], cards(['Ks'])[0]],
        boardCards: cards(['2s', '5s', '9s', '4h', '7d']),
        opponents: Array.from({ length: 2 }, () => ({ mode: 'random' as const, cards: [] })),
      });
      expect(result.trials).toBe(990 * 903); // C(45,2) * C(43,2)
      expect(result.winPct + result.tiePct + result.losePct).toBeCloseTo(100, 5);
    });
  });

  describe('estimateTotalTrials', () => {
    const hero: [Card, Card] = [cards(['As'])[0], cards(['Ks'])[0]];

    it('matches the true count for a single random opponent across every phase', () => {
      expect(estimateTotalTrials({ heroCards: hero, boardCards: [], opponents: [{ mode: 'random', cards: [] }] })).toBe(
        2097572400, // C(50,5) * C(45,2)
      );
      expect(
        estimateTotalTrials({
          heroCards: hero,
          boardCards: cards(['Kd', '7c', '2h']),
          opponents: [{ mode: 'random', cards: [] }],
        }),
      ).toBe(1070190); // C(47,2) * C(45,2)
      expect(
        estimateTotalTrials({
          heroCards: hero,
          boardCards: cards(['Kd', '7c', '2h', '9s', '3d']),
          opponents: [{ mode: 'random', cards: [] }],
        }),
      ).toBe(990); // C(45,2)
    });

    it('a specific opponent contributes no enumeration by itself', () => {
      expect(
        estimateTotalTrials({
          heroCards: hero,
          boardCards: cards(['Kd', '7c', '2h', '9s', '3d']),
          opponents: [{ mode: 'specific', cards: cards(['Qh', 'Qc']) }],
        }),
      ).toBe(1);
    });

    it('each extra random opponent multiplies the river trial count like one more C(pool,2)', () => {
      const base = { heroCards: hero, boardCards: cards(['Kd', '7c', '2h', '9s', '3d']) };
      // pool after hero+board = 45
      expect(estimateTotalTrials({ ...base, opponents: [{ mode: 'random', cards: [] }] })).toBe(990); // C(45,2)
      expect(
        estimateTotalTrials({ ...base, opponents: [{ mode: 'random', cards: [] }, { mode: 'random', cards: [] }] }),
      ).toBe(990 * 903); // C(45,2) * C(43,2)
    });
  });
});
