import { describe, it, expect } from 'vitest';
import { FULL_DECK, getRemainingCards } from '../deck';
import { cards } from './testHelpers';

describe('deck', () => {
  it('has exactly 52 unique cards', () => {
    expect(FULL_DECK).toHaveLength(52);
    expect(new Set(FULL_DECK.map((c) => c.id)).size).toBe(52);
  });

  it('getRemainingCards excludes every used card', () => {
    const used = cards(['As', 'Kd', '7c']);
    const remaining = getRemainingCards(used);
    expect(remaining).toHaveLength(49);
    for (const u of used) {
      expect(remaining.some((c) => c.id === u.id)).toBe(false);
    }
  });
});
