import { describe, it, expect } from 'vitest';
import { evaluateHand } from '../evaluator';
import { compareHands } from '../comparer';
import { cards } from './testHelpers';

describe('compareHands', () => {
  it('a higher category always wins regardless of kickers', () => {
    const trips = evaluateHand(cards(['2s', '2h', '2d', '9c', '8h']))!;
    const straight = evaluateHand(cards(['3s', '4h', '5d', '6c', '7h']))!;
    expect(compareHands(straight, trips)).toBeGreaterThan(0);
  });

  it('breaks ties within the same category via kickers', () => {
    const kkA = evaluateHand(cards(['Ks', 'Kh', 'As', '7d', '2c']))!;
    const kkQ = evaluateHand(cards(['Ks', 'Kh', 'Qs', '7d', '2c']))!;
    expect(compareHands(kkA, kkQ)).toBeGreaterThan(0);
  });

  it('returns 0 for identical hand values', () => {
    const a = evaluateHand(cards(['As', 'Ks', 'Qs', 'Js', 'Ts']))!;
    const b = evaluateHand(cards(['Ah', 'Kh', 'Qh', 'Jh', 'Th']))!;
    expect(compareHands(a, b)).toBe(0);
  });
});
