import { spawn, spawnSync } from 'child_process';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLocalUrl(baseUrl) {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseUrl);
}

function stopProcess(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

async function waitForServer(baseUrl, {
  healthPath = '/',
  maxRetries = 20,
  delayMs = 500,
  probeTimeoutMs = 5000,
} = {}) {
  const url = new URL(healthPath, baseUrl).toString();
  let lastError = null;

  for (let i = 0; i < maxRetries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), probeTimeoutMs);
    try {
      const res = await fetch(url, { method: 'GET', cache: 'no-store', signal: controller.signal });
      if (res.ok) return true;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
    await sleep(delayMs);
  }

  throw new Error(`Serveur indisponible sur ${url} après ${maxRetries} tentatives${lastError ? ` (${lastError.message})` : ''}`);
}

export async function ensureLocalServer({
  baseUrl,
  healthPath = '/',
  label = 'script',
  disableEnv = 'START_SERVER',
  initialRetries = 4,
  initialDelayMs = 500,
  startupRetries = 90,
  startupDelayMs = 1000,
} = {}) {
  if (!baseUrl) throw new Error('baseUrl requis pour ensureLocalServer');

  try {
    await waitForServer(baseUrl, { healthPath, maxRetries: initialRetries, delayMs: initialDelayMs });
    return () => {};
  } catch {
    if (process.env[disableEnv] === '0' || !isLocalUrl(baseUrl)) {
      throw new Error(`Serveur indisponible sur ${baseUrl}. Lancer npm run dev ou définir BASE_URL/APP_URL.`);
    }
  }

  console.log(`[${label}] Serveur indisponible sur ${baseUrl}; démarrage npm run dev...`);
  const child = spawn(npmCmd, ['run', 'dev'], {
    cwd: process.cwd(),
    env: process.env,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString().trim();
    if (text) console.log(`[next-dev] ${text}`);
  });
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString().trim();
    if (text) console.error(`[next-dev] ${text}`);
  });

  await waitForServer(baseUrl, { healthPath, maxRetries: startupRetries, delayMs: startupDelayMs });
  return () => stopProcess(child);
}
