import { APP_COMMIT, APP_VERSION, useUpdateCheck } from '../hooks/useUpdateCheck';

export function VersionFooter() {
  const { newVersion, applyUpdate } = useUpdateCheck();
  return (
    <footer className="version-footer">
      <span>
        ver {APP_VERSION}（{APP_COMMIT}）
      </span>
      {newVersion && (
        <button type="button" className="update-btn" onClick={applyUpdate}>
          新しい版 {newVersion} に更新
        </button>
      )}
    </footer>
  );
}
