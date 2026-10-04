import { PlayingCard } from './Card';
import type { Card } from '../poker/types';

export interface HandSelectorProps {
  title: string;
  slots: (Card | null)[];
  onOpen: (index: number) => void;
  onRandomize?: () => void;
  message?: string | null;
}

export function HandSelector({ title, slots, onOpen, onRandomize, message }: HandSelectorProps) {
  return (
    <section className="panel">
      <div className="panel-header-row">
        <h2 className="panel-title">{title}</h2>
        {onRandomize && (
          <button type="button" className="randomize-btn" onClick={onRandomize}>
            🎲 ランダム
          </button>
        )}
      </div>
      <div className="card-row">
        {slots.map((card, i) => (
          <PlayingCard key={i} card={card} size="lg" onClick={() => onOpen(i)} />
        ))}
      </div>
      {message && <p className="panel-message">{message}</p>}
    </section>
  );
}
