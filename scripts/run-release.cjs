const { spawnSync } = require('node:child_process');
const https = require('node:https');

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const hasGitHubToken = Boolean(token);
const publishMode = hasGitHubToken ? 'always' : 'never';

if (!hasGitHubToken) {
  console.warn('[release] GH_TOKEN/GITHUB_TOKEN not found. Building without publish.');
}

// Шаг 1: Собрать и загрузить на GitHub (как Draft)
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

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

// Шаг 2: Автоматически публикуем Draft → Release
if (!hasGitHubToken) {
  console.log('[release] Skipping auto-publish (no token).');
  process.exit(0);
}

console.log('[release] Publishing draft release on GitHub...');

function githubRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'books-ai-release-script',
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function publishDraft() {
  // Найти последний Draft
  const releases = await githubRequest('GET', '/repos/Jas952/books-ai/releases');
  const draft = Array.isArray(releases) && releases.find(r => r.draft);

  if (!draft) {
    console.log('[release] No draft release found — may already be published.');
    return;
  }

  console.log(`[release] Found draft: ${draft.tag_name} (id: ${draft.id})`);

  // Опубликовать
  const published = await githubRequest('PATCH', `/repos/Jas952/books-ai/releases/${draft.id}`, {
    draft: false
  });

  if (published.html_url) {
    console.log(`[release] ✅ Published: ${published.html_url}`);
  } else {
    console.error('[release] ❌ Failed to publish:', JSON.stringify(published));
    process.exit(1);
  }
}

publishDraft().catch(err => {
  console.error('[release] Error publishing draft:', err.message);
  process.exit(1);
});
