import { PlayingCard } from './Card';
import type { OpponentState } from '../hooks/usePokerCalculator';
import type { OpponentMode } from '../poker/types';

export interface OpponentSelectorProps {
  opponents: OpponentState[];
  maxOpponents: number;
  onModeChange: (oppIndex: number, mode: OpponentMode) => void;
  onOpenSlot: (oppIndex: number, cardIndex: 0 | 1) => void;
  onAdd: () => void;
  onRemove: (oppIndex: number) => void;
  onRandomize: (oppIndex: number) => void;
}

export function OpponentSelector({
  opponents,
  maxOpponents,
  onModeChange,
  onOpenSlot,
  onAdd,
  onRemove,
  onRandomize,
}: OpponentSelectorProps) {
  const showNumbers = opponents.length > 1;
  // With exactly 1 opponent, "random" stays an abstract average over every possible
  // hand (cheap to compute exactly). With 2+, an abstract random opponent multiplies
  // enumeration cost per extra opponent, so each one always holds a concrete hand
  // instead — picked by the 🎲 button or chosen by hand, never left abstract.
  const singleOpponent = opponents.length === 1;

  return (
    <section className="panel">
      <div className="panel-header-row">
        <h2 className="panel-title">相手（{opponents.length}人）</h2>
        {opponents.length < maxOpponents && (
          <button type="button" className="opp-add-btn" onClick={onAdd}>
            ＋ 相手を追加
          </button>
        )}
      </div>

      <div className="opp-list">
        {opponents.map((opp, oppIndex) => (
          <div key={oppIndex} className="opp-item">
            <div className="opp-item-header">
              {showNumbers && <span className="opp-label">相手{oppIndex + 1}</span>}
              {singleOpponent ? (
                <div className="segmented segmented-sm">
                  <button
                    type="button"
                    className={`segmented-btn ${opp.mode === 'random' ? 'segmented-btn-active' : ''}`}
                    onClick={() => onModeChange(oppIndex, 'random')}
                  >
                    ランダム
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${opp.mode === 'specific' ? 'segmented-btn-active' : ''}`}
                    onClick={() => onModeChange(oppIndex, 'specific')}
                  >
                    ハンド指定
                  </button>
                </div>
              ) : (
                <button type="button" className="randomize-btn" onClick={() => onRandomize(oppIndex)}>
                  🎲 ランダム
                </button>
              )}
              {opponents.length > 1 && (
                <button type="button" className="opp-remove-btn" onClick={() => onRemove(oppIndex)} aria-label={`相手${oppIndex + 1}を削除`}>
                  ×
                </button>
              )}
            </div>
            {(opp.mode === 'specific' || !singleOpponent) && (
              <div className="card-row">
                {opp.slots.map((card, cardIndex) => (
                  <PlayingCard key={cardIndex} card={card} size="lg" onClick={() => onOpenSlot(oppIndex, cardIndex as 0 | 1)} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
