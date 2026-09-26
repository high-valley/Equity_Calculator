import type { Card, Rank, Suit } from './types';

export const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

/** Numeric strength of a rank: 2..14 (Ace high). */
export const RANK_VALUE: Record<Rank, number> = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  T: 10,
  '9': 9,
  '8': 8,
  '7': 7,
  '6': 6,
  '5': 5,
  '4': 4,
  '3': 3,
  '2': 2,
};

export const SUIT_CHAR: Record<Suit, string> = {
  spades: 's',
  hearts: 'h',
  diamonds: 'd',
  clubs: 'c',
};

export const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

export const RANK_LABEL: Record<Rank, string> = {
  A: 'A',
  K: 'K',
  Q: 'Q',
  J: 'J',
  T: '10',
  '9': '9',
  '8': '8',
  '7': '7',
  '6': '6',
  '5': '5',
  '4': '4',
  '3': '3',
  '2': '2',
};

const RANK_NAME_JA: Record<Rank, string> = {
  A: 'エース',
  K: 'キング',
  Q: 'クイーン',
  J: 'ジャック',
  T: '10',
  '9': '9',
  '8': '8',
  '7': '7',
  '6': '6',
  '5': '5',
  '4': '4',
  '3': '3',
  '2': '2',
};

const SUIT_NAME_JA: Record<Suit, string> = {
  spades: 'スペード',
  hearts: 'ハート',
  diamonds: 'ダイヤ',
  clubs: 'クラブ',
};

export function cardId(rank: Rank, suit: Suit): string {
  return `${rank}${SUIT_CHAR[suit]}`;
}

export function makeCard(rank: Rank, suit: Suit): Card {
  return { rank, suit, id: cardId(rank, suit) };
}

export function cardAriaLabel(card: Card): string {
  return `${SUIT_NAME_JA[card.suit]}の${RANK_NAME_JA[card.rank]}`;
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}
