import { describe, it, expect } from 'vitest';
import { combinations, countCombinations } from '../combinations';

describe('combinations', () => {
  it('generates all C(n,k) combinations with no duplicates', () => {
    const items = [1, 2, 3, 4, 5];
    const combos = Array.from(combinations(items, 3));
    expect(combos).toHaveLength(10); // C(5,3)
    const asStrings = new Set(combos.map((c) => c.join(',')));
    expect(asStrings.size).toBe(10);
  });

  it('yields a single empty combination for k=0', () => {
    expect(Array.from(combinations([1, 2, 3], 0))).toEqual([[]]);
  });
});

describe('countCombinations', () => {
  it('matches known binomial coefficients', () => {
    expect(countCombinations(52, 2)).toBe(1326);
    expect(countCombinations(50, 5)).toBe(2118760);
    expect(countCombinations(7, 5)).toBe(21);
    expect(countCombinations(5, 0)).toBe(1);
  });
});
