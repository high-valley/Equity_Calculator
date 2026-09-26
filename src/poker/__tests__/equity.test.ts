import { describe, it, expect } from 'vitest';
import { computeEquitySync, estimateOuterSteps } from '../equity';
import { cards } from './testHelpers';

describe('computeEquitySync', () => {
  it('AA vs KK preflop (specific opponent): AA is a big favorite, win+tie+lose sum to 100%', () => {
    const [heroCards] = [cards(['As', 'Ah'])];
    const result = computeEquitySync({
      heroCards: [heroCards[0], heroCards[1]],
      boardCards: [],
      opponent: { mode: 'specific', cards: cards(['Kd', 'Kc']) },
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
      opponent: { mode: 'specific', cards: cards(['Qh', 'Qc']) },
    });
    expect(result.equityPct).toBeGreaterThan(40);
    expect(result.equityPct).toBeLessThan(50);
  });

  it('a made flush on the river crushes a random opponent', () => {
    const result = computeEquitySync({
      heroCards: [cards(['As'])[0], cards(['Ks'])[0]],
      boardCards: cards(['2s', '5s', '9s', '4h', '7d']),
      opponent: { mode: 'random', cards: [] },
    });
    expect(result.trials).toBe(990); // C(45,2)
    expect(result.equityPct).toBeGreaterThan(90);
  });

  it('a set on the turn is a strong favorite vs random with the right trial count', () => {
    const result = computeEquitySync({
      heroCards: [cards(['7s'])[0], cards(['7h'])[0]],
      boardCards: cards(['7d', '2c', '9h', 'Ks']),
      opponent: { mode: 'random', cards: [] },
    });
    expect(result.trials).toBe(45540); // C(46,2) * 44
    expect(result.equityPct).toBeGreaterThan(85);
  });

  it('flop equity vs random opponent enumerates every turn/river/opponent combo exactly', () => {
    const result = computeEquitySync({
      heroCards: [cards(['As'])[0], cards(['Ks'])[0]],
      boardCards: cards(['Kd', '7c', '2h']),
      opponent: { mode: 'random', cards: [] },
    });
    expect(result.trials).toBe(1070190); // C(47,2) * C(45,2)
    expect(result.winPct + result.tiePct + result.losePct).toBeCloseTo(100, 5);
  });

  it('a fully determined river hand resolves deterministically', () => {
    const result = computeEquitySync({
      heroCards: [cards(['As'])[0], cards(['Ks'])[0]],
      boardCards: cards(['Ad', 'Kd', 'Qd', 'Jd', '2c']),
      opponent: { mode: 'specific', cards: cards(['2s', '3s']) },
    });
    expect(result.trials).toBe(1);
    expect(result.winPct).toBe(100);
    expect(result.tiePct).toBe(0);
    expect(result.losePct).toBe(0);
  });

  it('estimateOuterSteps matches the true board-completion count for every phase', () => {
    const hero: [import('../types').Card, import('../types').Card] = [cards(['As'])[0], cards(['Ks'])[0]];
    expect(estimateOuterSteps({ heroCards: hero, boardCards: [], opponent: { mode: 'random', cards: [] } })).toBe(
      2118760,
    ); // C(50,5)
    expect(
      estimateOuterSteps({ heroCards: hero, boardCards: cards(['Kd', '7c', '2h']), opponent: { mode: 'random', cards: [] } }),
    ).toBe(1081); // C(47,2)
    expect(
      estimateOuterSteps({
        heroCards: hero,
        boardCards: cards(['Kd', '7c', '2h', '9s']),
        opponent: { mode: 'random', cards: [] },
      }),
    ).toBe(46); // C(46,1)
    expect(
      estimateOuterSteps({
        heroCards: hero,
        boardCards: cards(['Kd', '7c', '2h', '9s', '3d']),
        opponent: { mode: 'random', cards: [] },
      }),
    ).toBe(1);
  });
});
