import { PlayingCard } from './Card';
import type { OpponentState } from '../hooks/usePokerCalculator';
import type { EquityResultData, OpponentMode } from '../poker/types';

export interface OpponentSelectorProps {
  opponents: OpponentState[];
  maxOpponents: number;
  result: EquityResultData | null;
  onModeChange: (oppIndex: number, mode: OpponentMode) => void;
  onOpenSlot: (oppIndex: number, cardIndex: 0 | 1) => void;
  onAdd: () => void;
  onRemove: (oppIndex: number) => void;
  onRandomize: (oppIndex: number) => void;
}

export function OpponentSelector({
  opponents,
  maxOpponents,
  result,
  onModeChange,
  onOpenSlot,
  onAdd,
  onRemove,
  onRandomize,
}: OpponentSelectorProps) {
  const showNumbers = opponents.length > 1;
  // "ハンド不明" (mode 'random') is an exact average over every possible hand — cheap with
  // one opponent, but each extra unknown opponent multiplies enumeration cost, so with 2+
  // every opponent holds a concrete hand. The 🎲 button is separate from that: it always
  // deals a concrete random hand (mode 'specific').
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
        {opponents.map((opp, oppIndex) => {
          const oppResult = result?.opponentResults?.[oppIndex];
          return (
            <div key={oppIndex} className="opp-item">
              <div className="opp-item-header">
                {showNumbers && <span className="opp-label">相手{oppIndex + 1}</span>}
                {singleOpponent && (
                  <div className="segmented segmented-sm">
                    <button
                      type="button"
                      className={`segmented-btn ${opp.mode === 'random' ? 'segmented-btn-active' : ''}`}
                      onClick={() => onModeChange(oppIndex, 'random')}
                    >
                      ハンド不明
                    </button>
                    <button
                      type="button"
                      className={`segmented-btn ${opp.mode === 'specific' ? 'segmented-btn-active' : ''}`}
                      onClick={() => onModeChange(oppIndex, 'specific')}
                    >
                      ハンド指定
                    </button>
                  </div>
                )}
                <button type="button" className="randomize-btn" onClick={() => onRandomize(oppIndex)}>
                  🎲 ランダム
                </button>
                {opponents.length > 1 && (
                  <button type="button" className="opp-remove-btn" onClick={() => onRemove(oppIndex)} aria-label={`相手${oppIndex + 1}を削除`}>
                    ×
                  </button>
                )}
              </div>
              {opp.mode === 'random' && singleOpponent && (
                <p className="opp-unknown-note">相手の手札がわからない状態で、ありうる全てのハンドを平均して計算します。</p>
              )}
              {(opp.mode === 'specific' || !singleOpponent) && (
                <div className="card-row">
                  {opp.slots.map((card, cardIndex) => (
                    <PlayingCard key={cardIndex} card={card} size="lg" onClick={() => onOpenSlot(oppIndex, cardIndex as 0 | 1)} />
                  ))}
                </div>
              )}
              {oppResult && <div className="opp-equity">相手のエクイティ {oppResult.equityPct.toFixed(1)}%</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
