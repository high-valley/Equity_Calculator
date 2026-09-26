import { execSync } from 'node:child_process';
import { configDefaults, defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Version = build time in JST ("20260926-1352"). It sorts as a string, so the app can
// tell "the site has something newer than what I'm running" with a plain `>`.
function buildVersion(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();
  return `${jst.slice(0, 10).replace(/-/g, '')}-${jst.slice(11, 16).replace(':', '')}`;
}

function buildCommit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
}

const APP_VERSION = buildVersion();
const APP_COMMIT = buildCommit();

// Emits dist/version.json, which the running app fetches (bypassing caches) to detect a newer deploy.
function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: APP_VERSION, commit: APP_COMMIT }),
      });
    },
  };
}

export default defineConfig({
  // Relative base so the build works when served from a GitHub Pages project
  // subpath (https://<owner>.github.io/<repo>/) without hardcoding the repo name.
  base: './',
  plugins: [react(), versionFile()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __APP_COMMIT__: JSON.stringify(APP_COMMIT),
  },
  test: {
    environment: 'node',
    globals: true,
    // .claude/ holds agent worktrees (full repo copies); don't run their tests twice.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
});
