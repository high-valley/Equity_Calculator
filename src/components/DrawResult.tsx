import type { DrawInfo } from '../poker/types';

export function DrawResult({ draw }: { draw: DrawInfo }) {
  if (!draw.flushDraw && !draw.straightDraw) return null;
  return (
    <section className="panel draw-panel">
      <div className="draw-badges">
        {draw.flushDraw && <span className="draw-badge">フラッシュドロー</span>}
        {draw.straightDraw && <span className="draw-badge">ストレートドロー</span>}
      </div>
      <p className="draw-outs">アウツ: {draw.outs}枚</p>
    </section>
  );
}
