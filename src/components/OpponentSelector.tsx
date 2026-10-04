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
}

export function OpponentSelector({ opponents, maxOpponents, onModeChange, onOpenSlot, onAdd, onRemove }: OpponentSelectorProps) {
  const showNumbers = opponents.length > 1;

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
              {opponents.length > 1 && (
                <button type="button" className="opp-remove-btn" onClick={() => onRemove(oppIndex)} aria-label={`相手${oppIndex + 1}を削除`}>
                  ×
                </button>
              )}
            </div>
            {opp.mode === 'specific' && (
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
