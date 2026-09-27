import { useEffect, useRef, useState } from 'react';

export interface SettingsButtonProps {
  bgmEnabled: boolean;
  onToggleBgm: () => void;
}

export function SettingsButton({ bgmEnabled, onToggleBgm }: SettingsButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  return (
    <div className="settings-root" ref={rootRef}>
      <button
        type="button"
        className="settings-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="設定"
        aria-expanded={open}
      >
        ⚙
      </button>
      {open && (
        <div className="settings-popover">
          <label className="settings-row">
            <span>BGM</span>
            <button
              type="button"
              role="switch"
              aria-checked={bgmEnabled}
              className={`settings-switch ${bgmEnabled ? 'settings-switch-on' : ''}`}
              onClick={onToggleBgm}
            >
              <span className="settings-switch-knob" />
            </button>
          </label>
        </div>
      )}
    </div>
  );
}
