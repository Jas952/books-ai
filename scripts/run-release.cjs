const { spawnSync } = require('node:child_process');

const hasGitHubToken = Boolean(process.env.GH_TOKEN || process.env.GITHUB_TOKEN);
const publishMode = hasGitHubToken ? 'always' : 'never';

if (!hasGitHubToken) {
  console.warn('[release] GH_TOKEN/GITHUB_TOKEN not found. Building without publish.');
}

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['electron-builder', '--mac', '--publish', publishMode],
  {
    stdio: 'inherit',
    shell: false,
    env: process.env
  }
);

if (result.error) {
  console.error('[release] Failed to run electron-builder:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
