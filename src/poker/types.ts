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

export interface OpponentSpec {
  mode: OpponentMode;
  /** Only used when mode is 'specific'. Must have length 0, 1, or 2. */
  cards: Card[];
}

export interface EquityResultData {
  winPct: number;
  tiePct: number;
  losePct: number;
  equityPct: number;
  /** Number of opponent/board scenarios enumerated. */
  trials: number;
}

export interface DrawInfo {
  flushDraw: boolean;
  straightDraw: boolean;
  outs: number;
}
