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
  'Equity is the share of the pot you expect to win on average if the hand were played out from here. ' +
  'A tie counts as winning half the pot.';

export function EquityResult({ result, isCalculating, progressPct, blocked, message }: EquityResultProps) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <section className="panel equity-panel">
      <div className="equity-header">
        <h2 className="panel-title">EQUITY</h2>
        <button
          type="button"
          className="info-btn"
          onClick={() => setShowInfo((v) => !v)}
          aria-label="What is equity?"
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
              <span>Calculating...</span>
              {progressPct !== null && (
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progressPct.toFixed(0)}%` }} />
                </div>
              )}
            </div>
          )}

          {result && (
            <div className="equity-bars">
              <EquityBar label="WIN" pct={result.winPct} className="bar-win" />
              <EquityBar label="TIE" pct={result.tiePct} className="bar-tie" />
              <EquityBar label="LOSE" pct={result.losePct} className="bar-lose" />
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
