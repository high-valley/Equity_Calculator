import { PlayingCard } from './Card';
import type { Card } from '../poker/types';

export interface HandSelectorProps {
  title: string;
  slots: (Card | null)[];
  onOpen: (index: number) => void;
  onRandomize?: () => void;
  message?: string | null;
  equityPct?: number | null;
}

export function HandSelector({ title, slots, onOpen, onRandomize, message, equityPct }: HandSelectorProps) {
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
      <div className="hand-row">
        <div className="card-row">
          {slots.map((card, i) => (
            <PlayingCard key={i} card={card} size="lg" onClick={() => onOpen(i)} />
          ))}
        </div>
        {equityPct != null && (
          <div className="hand-equity">
            <span className="hand-equity-label">エクイティ</span>
            <span className="hand-equity-value">{equityPct.toFixed(1)}%</span>
          </div>
        )}
      </div>
      {message && <p className="panel-message">{message}</p>}
    </section>
  );
}
