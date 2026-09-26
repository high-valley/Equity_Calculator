import { describe, it, expect } from 'vitest';
import { analyzeDraws } from '../outs';
import { cards } from './testHelpers';

describe('analyzeDraws', () => {
  it('detects a flush draw with 9 outs', () => {
    const info = analyzeDraws(cards(['As', 'Ks']), cards(['2s', '5s', '9h']));
    expect(info.flushDraw).toBe(true);
    expect(info.outs).toBeGreaterThanOrEqual(9);
  });

  it('detects an open-ended straight draw with 8 outs', () => {
    // 6-7-8-9 open ended: needs a 5 or a T.
    const info = analyzeDraws(cards(['6h', '7d']), cards(['8c', '9s', '2h']));
    expect(info.straightDraw).toBe(true);
    expect(info.outs).toBeGreaterThanOrEqual(8);
  });

  it('reports no draws for preflop (fewer than 5 cards)', () => {
    const info = analyzeDraws(cards(['As', 'Ks']), []);
    expect(info.flushDraw).toBe(false);
    expect(info.straightDraw).toBe(false);
    expect(info.outs).toBe(0);
  });

  it('reports no draws once the river is dealt (7 cards, nothing left to come)', () => {
    const info = analyzeDraws(cards(['As', 'Ks']), cards(['2s', '5s', '9h', '3d', '7c']));
    expect(info.outs).toBe(0);
  });
});
