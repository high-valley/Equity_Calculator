import type { DrawInfo } from '../poker/types';

export function DrawResult({ draw }: { draw: DrawInfo }) {
  if (!draw.flushDraw && !draw.straightDraw) return null;
  return (
    <section className="panel draw-panel">
      <div className="draw-badges">
        {draw.flushDraw && <span className="draw-badge">FLUSH DRAW</span>}
        {draw.straightDraw && <span className="draw-badge">STRAIGHT DRAW</span>}
      </div>
      <p className="draw-outs">OUTS: {draw.outs} cards</p>
    </section>
  );
}
