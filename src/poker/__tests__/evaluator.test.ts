import { describe, it, expect } from 'vitest';
import { evaluateHand, describeHand, describeHandJa } from '../evaluator';
import { HandCategory } from '../types';
import { cards } from './testHelpers';

describe('evaluateHand', () => {
  it('returns null with fewer than 5 cards', () => {
    expect(evaluateHand(cards(['As', 'Ks']))).toBeNull();
    expect(evaluateHand(cards(['As', 'Ks', 'Qs', 'Js']))).toBeNull();
  });

  it('recognizes a Royal Flush', () => {
    const v = evaluateHand(cards(['As', 'Ks', 'Qs', 'Js', 'Ts']))!;
    expect(v.category).toBe(HandCategory.StraightFlush);
    expect(v.kickers[0]).toBe(14);
    expect(describeHand(v)).toBe('Royal Flush');
  });

  it('recognizes a Straight Flush', () => {
    const v = evaluateHand(cards(['9s', '8s', '7s', '6s', '5s']))!;
    expect(v.category).toBe(HandCategory.StraightFlush);
    expect(v.kickers[0]).toBe(9);
  });

  it('recognizes Four of a Kind', () => {
    const v = evaluateHand(cards(['As', 'Ah', 'Ad', 'Ac', 'Kd']))!;
    expect(v.category).toBe(HandCategory.FourOfAKind);
    expect(v.kickers).toEqual([14, 13]);
  });

  it('recognizes a Full House', () => {
    const v = evaluateHand(cards(['As', 'Ah', 'Ad', 'Kc', 'Kh']))!;
    expect(v.category).toBe(HandCategory.FullHouse);
    expect(v.kickers).toEqual([14, 13]);
  });

  it('recognizes a Flush', () => {
    const v = evaluateHand(cards(['As', 'Js', '9s', '6s', '3s']))!;
    expect(v.category).toBe(HandCategory.Flush);
    expect(v.kickers).toEqual([14, 11, 9, 6, 3]);
  });

  it('recognizes a Straight (Ace high)', () => {
    const v = evaluateHand(cards(['As', 'Kd', 'Qc', 'Jh', 'Ts']))!;
    expect(v.category).toBe(HandCategory.Straight);
    expect(v.kickers[0]).toBe(14);
  });

  it('recognizes the Wheel as a 5-high Straight', () => {
    const v = evaluateHand(cards(['As', '2d', '3c', '4h', '5s']))!;
    expect(v.category).toBe(HandCategory.Straight);
    expect(v.kickers[0]).toBe(5);
  });

  it('recognizes Three of a Kind', () => {
    const v = evaluateHand(cards(['As', 'Ah', 'Ad', 'Kc', 'Qh']))!;
    expect(v.category).toBe(HandCategory.ThreeOfAKind);
    expect(v.kickers).toEqual([14, 13, 12]);
  });

  it('recognizes Two Pair', () => {
    const v = evaluateHand(cards(['As', 'Ah', 'Kd', 'Kc', 'Qh']))!;
    expect(v.category).toBe(HandCategory.TwoPair);
    expect(v.kickers).toEqual([14, 13, 12]);
  });

  it('recognizes a Pair', () => {
    const v = evaluateHand(cards(['As', 'Ah', 'Kd', 'Qc', 'Jh']))!;
    expect(v.category).toBe(HandCategory.OnePair);
    expect(v.kickers).toEqual([14, 13, 12, 11]);
  });

  it('recognizes High Card', () => {
    const v = evaluateHand(cards(['As', 'Kd', 'Qc', 'Jh', '9s']))!;
    expect(v.category).toBe(HandCategory.HighCard);
    expect(v.kickers).toEqual([14, 13, 12, 11, 9]);
  });

  it('picks the best 5 of 7 cards', () => {
    // Two pair on board (Kd Kc / 7c 7h) plus hero pair of Aces => best hand is Aces up, Kings, not the board two pair.
    const v = evaluateHand(cards(['As', 'Ah', 'Kd', 'Kc', '7c', '7h', '2s']))!;
    expect(v.category).toBe(HandCategory.TwoPair);
    expect(v.kickers).toEqual([14, 13, 7]);
  });

  it('finds a flush hidden among 7 cards', () => {
    const v = evaluateHand(cards(['2s', '5s', '9s', 'Ks', '3s', '4h', '7d']))!;
    expect(v.category).toBe(HandCategory.Flush);
    expect(v.kickers).toEqual([13, 9, 5, 3, 2]);
  });

  it('kicker comparisons: pair of kings, ace kicker beats queen kicker', () => {
    const a = evaluateHand(cards(['Ks', 'Kh', 'As', '7d', '2c']))!;
    const b = evaluateHand(cards(['Ks', 'Kh', 'Qs', '7d', '2c']))!;
    expect(a.kickers[1]).toBeGreaterThan(b.kickers[1]);
  });
});

describe('describeHand', () => {
  it('produces human-readable names', () => {
    expect(describeHand(evaluateHand(cards(['Ks', 'Kh', 'Kd', '7c', '2h']))!)).toBe('Three of a Kind, Kings');
    expect(describeHand(evaluateHand(cards(['Ks', 'Kh', '7c', '7d', '2h']))!)).toBe('Two Pair, Kings and Sevens');
    expect(describeHand(evaluateHand(cards(['Ks', 'Kh', '7c', '9d', '2h']))!)).toBe('Pair of Kings');
  });
});

describe('describeHandJa', () => {
  it('produces Japanese hand names', () => {
    expect(describeHandJa(evaluateHand(cards(['As', 'Ks', 'Qs', 'Js', 'Ts']))!)).toBe('ロイヤルフラッシュ');
    expect(describeHandJa(evaluateHand(cards(['Ks', 'Kh', 'Kd', '7c', '2h']))!)).toBe('スリーカード（キング）');
    expect(describeHandJa(evaluateHand(cards(['Ks', 'Kh', '7c', '7d', '2h']))!)).toBe('ツーペア（キングと7）');
    expect(describeHandJa(evaluateHand(cards(['Ks', 'Kh', '7c', '9d', '2h']))!)).toBe('ワンペア（キング）');
    expect(describeHandJa(evaluateHand(cards(['As', 'Kd', 'Qc', 'Jh', '9s']))!)).toBe('ハイカード（エース）');
  });
});
