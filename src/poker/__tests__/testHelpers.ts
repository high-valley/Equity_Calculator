import { makeCard } from '../cards';
import type { Card, Rank, Suit } from '../types';

const SUIT_FOR_CHAR: Record<string, Suit> = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' };

/** Parses a shorthand card id like "As", "Td", "7c" into a Card. */
export function c(id: string): Card {
  const rank = id.slice(0, id.length - 1).toUpperCase() as Rank;
  const suit = SUIT_FOR_CHAR[id[id.length - 1].toLowerCase()];
  return makeCard(rank, suit);
}

export function cards(ids: string[]): Card[] {
  return ids.map(c);
}
