import { useEffect } from 'react';
import { RANK_LABEL, RANKS, SUIT_SYMBOL, SUITS, cardAriaLabel, isRedSuit, makeCard } from '../poker/cards';
import type { Card, Suit } from '../poker/types';

export interface CardPickerProps {
  title: string;
  usedCardIds: Set<string>;
  currentCardId?: string;
  onSelect: (card: Card) => void;
  onClear?: () => void;
  onClose: () => void;
}

export function CardPicker({ title, usedCardIds, currentCardId, onSelect, onClear, onClose }: CardPickerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="picker-header">
          <span className="picker-title">{title}</span>
          <button type="button" className="picker-close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        <div className="picker-grid">
          {SUITS.map((suit: Suit) => (
            <div key={suit} className="picker-suit-row">
              <span className={`picker-suit-symbol ${isRedSuit(suit) ? 'pc-red' : 'pc-black'}`}>{SUIT_SYMBOL[suit]}</span>
              <div className="picker-rank-row">
                {RANKS.map((rank) => {
                  const card = makeCard(rank, suit);
                  const isUsed = usedCardIds.has(card.id) && card.id !== currentCardId;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`picker-cell ${isRedSuit(suit) ? 'pc-red' : 'pc-black'} ${card.id === currentCardId ? 'picker-cell-current' : ''}`}
                      disabled={isUsed}
                      aria-label={cardAriaLabel(card)}
                      onClick={() => onSelect(card)}
                    >
                      {RANK_LABEL[rank]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {onClear && (
          <button type="button" className="picker-clear" onClick={onClear}>
            カードを外す
          </button>
        )}
      </div>
    </div>
  );
}
