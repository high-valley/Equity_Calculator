import { PlayingCard } from './Card';
import type { Card, OpponentMode } from '../poker/types';

export interface OpponentSelectorProps {
  mode: OpponentMode;
  slots: (Card | null)[];
  onModeChange: (mode: OpponentMode) => void;
  onOpenSlot: (index: 0 | 1) => void;
}

export function OpponentSelector({ mode, slots, onModeChange, onOpenSlot }: OpponentSelectorProps) {
  return (
    <section className="panel">
      <h2 className="panel-title">OPPONENT</h2>
      <div className="segmented">
        <button
          type="button"
          className={`segmented-btn ${mode === 'random' ? 'segmented-btn-active' : ''}`}
          onClick={() => onModeChange('random')}
        >
          Random
        </button>
        <button
          type="button"
          className={`segmented-btn ${mode === 'specific' ? 'segmented-btn-active' : ''}`}
          onClick={() => onModeChange('specific')}
        >
          Specific Hand
        </button>
      </div>
      {mode === 'specific' && (
        <div className="card-row">
          {slots.map((card, i) => (
            <PlayingCard key={i} card={card} size="lg" onClick={() => onOpenSlot(i as 0 | 1)} />
          ))}
        </div>
      )}
    </section>
  );
}
