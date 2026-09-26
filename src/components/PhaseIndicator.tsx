import type { Phase } from '../poker/types';

const PHASES: { key: Phase; label: string }[] = [
  { key: 'preflop', label: 'PRE-FLOP' },
  { key: 'flop', label: 'FLOP' },
  { key: 'turn', label: 'TURN' },
  { key: 'river', label: 'RIVER' },
];

export function PhaseIndicator({ phase }: { phase: Phase }) {
  return (
    <div className="phase-indicator" role="tablist" aria-label="Current phase">
      {PHASES.map((p) => (
        <span key={p.key} className={`phase-pill ${p.key === phase ? 'phase-pill-active' : ''}`} role="tab" aria-selected={p.key === phase}>
          {p.label}
        </span>
      ))}
    </div>
  );
}
