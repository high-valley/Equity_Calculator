import { PlayingCard } from './Card';
import type { Card } from '../poker/types';

export interface BoardProps {
  cards: Card[];
  onOpen: (index: number) => void;
}

const BOARD_SIZE = 5;

export function Board({ cards, onOpen }: BoardProps) {
  return (
    <section className="panel">
      <h2 className="panel-title">BOARD</h2>
      <div className="card-row">
        {Array.from({ length: BOARD_SIZE }, (_, i) => {
          const card = cards[i] ?? null;
          const disabled = i > cards.length;
          return <PlayingCard key={i} card={card} size="md" onClick={() => onOpen(i)} disabled={disabled} faded={disabled} />;
        })}
      </div>
    </section>
  );
}
