import { PlayingCard } from './Card';
import type { Card } from '../poker/types';

export interface HandSelectorProps {
  title: string;
  slots: (Card | null)[];
  onOpen: (index: number) => void;
  message?: string | null;
}

export function HandSelector({ title, slots, onOpen, message }: HandSelectorProps) {
  return (
    <section className="panel">
      <h2 className="panel-title">{title}</h2>
      <div className="card-row">
        {slots.map((card, i) => (
          <PlayingCard key={i} card={card} size="lg" onClick={() => onOpen(i)} />
        ))}
      </div>
      {message && <p className="panel-message">{message}</p>}
    </section>
  );
}
