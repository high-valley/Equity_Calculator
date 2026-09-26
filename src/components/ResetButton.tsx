export function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <button type="button" className="reset-btn" onClick={onReset}>
      リセット
    </button>
  );
}
