export function HandResult({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <section className="panel">
      <h2 className="panel-title">CURRENT HAND</h2>
      <p className="hand-label">{label}</p>
    </section>
  );
}
