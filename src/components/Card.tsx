import { RANK_LABEL, SUIT_SYMBOL, cardAriaLabel, isRedSuit } from '../poker/cards';
import type { Card as CardModel } from '../poker/types';

export interface CardProps {
  card: CardModel | null;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  faded?: boolean;
}

export function PlayingCard({ card, size = 'md', onClick, disabled, faded }: CardProps) {
  const className = ['pc', `pc-${size}`, card ? (isRedSuit(card.suit) ? 'pc-red' : 'pc-black') : 'pc-empty', faded ? 'pc-faded' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
      aria-label={card ? cardAriaLabel(card) : 'Empty card slot'}
    >
      {card ? (
        <>
          <span className="pc-rank pc-rank-top">{RANK_LABEL[card.rank]}</span>
          <span className="pc-suit">{SUIT_SYMBOL[card.suit]}</span>
          <span className="pc-rank pc-rank-bottom">{RANK_LABEL[card.rank]}</span>
        </>
      ) : (
        <span className="pc-plus">+</span>
      )}
    </button>
  );
}
