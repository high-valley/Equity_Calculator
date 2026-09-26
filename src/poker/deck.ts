import { RANKS, SUITS, makeCard } from './cards';
import type { Card } from './types';

/** All 52 cards, in a stable order (spades A..2, hearts A..2, diamonds A..2, clubs A..2). */
export const FULL_DECK: Card[] = SUITS.flatMap((suit) => RANKS.map((rank) => makeCard(rank, suit)));

const DECK_BY_ID: Map<string, Card> = new Map(FULL_DECK.map((c) => [c.id, c]));

export function cardById(id: string): Card {
  const card = DECK_BY_ID.get(id);
  if (!card) throw new Error(`Unknown card id: ${id}`);
  return card;
}

/** Returns the 52-card deck minus any cards already in use (by id). */
export function getRemainingCards(usedCards: Card[]): Card[] {
  const used = new Set(usedCards.map((c) => c.id));
  return FULL_DECK.filter((c) => !used.has(c.id));
}
