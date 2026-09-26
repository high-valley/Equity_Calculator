import { RANK_VALUE, RANK_LABEL } from './cards';
import { bestComboOfN, decodeScore } from './handScore';
import type { Card, HandValue } from './types';
import { HandCategory } from './types';

const SUIT_INDEX: Record<Card['suit'], number> = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };

/**
 * Evaluates the best 5-card poker hand from 5, 6 or 7 cards.
 * Returns null if fewer than 5 cards are available (no hand can be formed yet).
 */
export function evaluateHand(cards: Card[]): HandValue | null {
  if (cards.length < 5) return null;

  const ranks = cards.map((c) => RANK_VALUE[c.rank]);
  const suits = cards.map((c) => SUIT_INDEX[c.suit]);
  const { score, indices } = bestComboOfN(ranks, suits);
  const { category, kickers } = decodeScore(score);
  const bestCards = indices.map((i) => cards[i]);

  return { category, kickers, cards: bestCards };
}

const CATEGORY_NAME: Record<HandCategory, string> = {
  [HandCategory.HighCard]: 'High Card',
  [HandCategory.OnePair]: 'Pair',
  [HandCategory.TwoPair]: 'Two Pair',
  [HandCategory.ThreeOfAKind]: 'Three of a Kind',
  [HandCategory.Straight]: 'Straight',
  [HandCategory.Flush]: 'Flush',
  [HandCategory.FullHouse]: 'Full House',
  [HandCategory.FourOfAKind]: 'Four of a Kind',
  [HandCategory.StraightFlush]: 'Straight Flush',
};

const PLURAL_RANK: Record<number, string> = {
  14: 'Aces',
  13: 'Kings',
  12: 'Queens',
  11: 'Jacks',
  10: 'Tens',
  9: 'Nines',
  8: 'Eights',
  7: 'Sevens',
  6: 'Sixes',
  5: 'Fives',
  4: 'Fours',
  3: 'Threes',
  2: 'Twos',
};

function rankLabel(value: number): string {
  const entry = Object.entries(RANK_VALUE).find(([, v]) => v === value);
  return entry ? RANK_LABEL[entry[0] as keyof typeof RANK_LABEL] : String(value);
}

/** Human-readable name for a hand value, e.g. "Pair of Kings", "Two Pair, Aces and Kings". */
export function describeHand(value: HandValue): string {
  const { category, kickers } = value;
  switch (category) {
    case HandCategory.StraightFlush:
      return kickers[0] === 14 ? 'Royal Flush' : `Straight Flush, ${rankLabel(kickers[0])} High`;
    case HandCategory.FourOfAKind:
      return `Four of a Kind, ${PLURAL_RANK[kickers[0]]}`;
    case HandCategory.FullHouse:
      return `Full House, ${PLURAL_RANK[kickers[0]]} over ${PLURAL_RANK[kickers[1]]}`;
    case HandCategory.Flush:
      return `Flush, ${rankLabel(kickers[0])} High`;
    case HandCategory.Straight:
      return `Straight, ${rankLabel(kickers[0])} High`;
    case HandCategory.ThreeOfAKind:
      return `Three of a Kind, ${PLURAL_RANK[kickers[0]]}`;
    case HandCategory.TwoPair:
      return `Two Pair, ${PLURAL_RANK[kickers[0]]} and ${PLURAL_RANK[kickers[1]]}`;
    case HandCategory.OnePair:
      return `Pair of ${PLURAL_RANK[kickers[0]]}`;
    case HandCategory.HighCard:
      return `High Card, ${rankLabel(kickers[0])}`;
    default:
      return CATEGORY_NAME[category];
  }
}
