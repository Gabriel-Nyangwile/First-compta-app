#!/usr/bin/env node
/**
 * Simple health + legacy navbar path regression test.
 * Fails (non-zero exit) if:
 *  - (Always) A legacy or forbidden navbar file path is found (src/components/Navbar.jsx OR src/components/NavbarDropdown.jsx root)
 *  - (Always) Any import in source uses the banned alias '@/component/' (missing 's')
 *  - (Strict mode only) The dev server (default http://localhost:3000) does not answer 200 on '/'
 *
 * Strict HTTP mode can be enabled via:
 *   node scripts/smoke-health.js --strict-http
 *   STRICT_HTTP=1 node scripts/smoke-health.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

function fail(msg) {
  console.error('\u274c  FAIL:', msg);
  process.exitCode = 1;
}

function info(msg) { console.log('\u2139\ufe0f ', msg); }

// 1. Check forbidden files
const forbiddenFiles = [
  'src/components/Navbar.jsx',
  'src/components/NavbarDropdown.jsx'
];
for (const rel of forbiddenFiles) {
  const abs = path.join(projectRoot, rel.replace(/\\/g, '/'));
  if (fs.existsSync(abs)) {
    fail(`Forbidden legacy file present: ${rel}`);
  } else {
    info(`OK missing legacy: ${rel}`);
  }
}

// 2. Scan for banned alias '@/component/'
function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.next')) continue; // skip heavy
      scanDir(full);
    } else if (/\.(js|jsx|ts|tsx|mjs)$/.test(e.name)) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes("@/component/")) {
        fail(`Banned alias '@/component/' found in ${path.relative(projectRoot, full)}`);
      }
    }
  }
}
scanDir(path.join(projectRoot, 'src'));

// 3. Optional HTTP smoke (strict mode enforces; otherwise best-effort)
const base = process.env.HEALTH_BASE || 'http://localhost:3000';
const timeoutMs = 4000;
const strictHttp = process.argv.includes('--strict-http') || process.env.STRICT_HTTP === '1';

function checkHttp(url) {
  return new Promise(resolve => {
    const req = http.get(url, res => {
        const { statusCode } = res;
        if (statusCode !== 200) {
          fail(`HTTP ${url} returned status ${statusCode}`);
        } else {
          info(`HTTP ${url} -> 200 OK`);
        }
      res.resume();
      resolve();
    });
    req.on('error', err => {
      if (strictHttp) {
        fail(`HTTP strict mode: unable to reach ${url} (${(err && err.message) || err})`);
      } else {
        info(`Skip HTTP check (${url}): ${(err && err.message) || err}`);
      }
      resolve();
    });
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('timeout')); });
  });
}

await checkHttp(base + '/');
// Try localhost then 127.0.0.1 if first fails in non-strict mode; in strict still record both failures.
if (process.exitCode && /localhost/.test(base)) {
  const alt = base.replace('localhost','127.0.0.1');
  info(`Retry on ${alt}`);
  const prevExit = process.exitCode;
  process.exitCode = 0; // reset temporarily to distinguish second attempt
  await checkHttp(alt + '/');
  if (prevExit && process.exitCode) {
    // both failed - restore failure
    process.exitCode = 1;
  }
}

if (strictHttp && process.exitCode) {
  console.error('\nStrict mode: failing due to HTTP unavailability.');
}

if (process.exitCode) {
  console.error('\nOne or more health checks failed.');
  process.exit(process.exitCode);
} else {
  console.log('\n\u2705 Smoke health test passed.');
}
