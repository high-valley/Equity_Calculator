import { useState } from 'react';
import type { EquityResultData } from '../poker/types';

export interface EquityResultProps {
  result: EquityResultData | null;
  isCalculating: boolean;
  progressPct: number | null;
  blocked: boolean;
  message: string | null;
}

const EXPLANATION =
  'エクイティとは、現在の状況から最終的にポットを獲得すると期待される割合です。' +
  '引き分けの場合はポットの半分を獲得するとして計算します。';

export function EquityResult({ result, isCalculating, progressPct, blocked, message }: EquityResultProps) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <section className="panel equity-panel">
      <div className="equity-header">
        <h2 className="panel-title">エクイティ</h2>
        <button
          type="button"
          className="info-btn"
          onClick={() => setShowInfo((v) => !v)}
          aria-label="エクイティとは？"
        >
          i
        </button>
      </div>
      {showInfo && <p className="info-popover">{EXPLANATION}</p>}

      {blocked ? (
        <p className="panel-message">{message}</p>
      ) : (
        <>
          <div className="equity-big">{result ? `${result.equityPct.toFixed(2)}%` : '—'}</div>

          {isCalculating && (
            <div className="calc-status">
              <span>計算中...</span>
              {progressPct !== null && (
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progressPct.toFixed(0)}%` }} />
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="equity-bars">
              <EquityBar label="勝ち" pct={result.winPct} className="bar-win" />
              <EquityBar label="引分" pct={result.tiePct} className="bar-tie" />
              <EquityBar label="負け" pct={result.losePct} className="bar-lose" />
            </div>
          )}
        </>
      )}
    </section>
  );
}

function EquityBar({ label, pct, className }: { label: string; pct: number; className: string }) {
  return (
    <div className="equity-bar-row">
      <span className="equity-bar-label">{label}</span>
      <div className="equity-bar-track">
        <div className={`equity-bar-fill ${className}`} style={{ width: `${Math.max(pct, 0.5)}%` }} />
      </div>
      <span className="equity-bar-pct">{pct.toFixed(2)}%</span>
    </div>
  );
}
