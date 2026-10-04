export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';

export interface Card {
  rank: Rank;
  suit: Suit;
  /** Canonical two-character id, e.g. "As", "Kh", "Td", "7c". */
  id: string;
}

/** Hand category, ranked low to high. Royal Flush is the top of StraightFlush. */
export enum HandCategory {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}

export interface HandValue {
  category: HandCategory;
  /** Rank strengths (14=A .. 2), ordered most significant first, used to break ties within a category. */
  kickers: number[];
  /** The 5 cards that make up the best hand, for display purposes. */
  cards: Card[];
}

export type Phase = 'preflop' | 'flop' | 'turn' | 'river';

export type OpponentMode = 'random' | 'specific';

/** One seat at the table. A 'random' opponent's cards are unknown (ignored here);
 *  a 'specific' opponent's cards, once fully chosen, must have length 2. */
export interface OpponentSlot {
  mode: OpponentMode;
  cards: Card[];
}

/** Hard cap on total opponents: hero + 8 is a standard 9-max table. */
export const MAX_OPPONENTS = 8;

export interface PlayerEquityResultData {
  winPct: number;
  tiePct: number;
  losePct: number;
  equityPct: number;
}

export interface EquityResultData extends PlayerEquityResultData {
  /** Number of opponent/board scenarios enumerated. */
  trials: number;
  /** Each opponent's own win/tie/lose/equity, in the same order as the request's
   *  `opponents` array. Optional only because the precomputed preflop-vs-random
   *  table predates this field; everything computed live always has it. */
  opponentResults?: PlayerEquityResultData[];
}

export interface DrawInfo {
  flushDraw: boolean;
  straightDraw: boolean;
  outs: number;
}
