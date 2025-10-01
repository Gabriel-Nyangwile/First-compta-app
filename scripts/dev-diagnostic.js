#!/usr/bin/env node
/**
 * Quick dev server diagnostic:
 * - Node version
 * - Checks for DATABASE_URL
 * - Attempts prisma generate (dry) and migrate status
 * - Reports occupied port 3000
 */
import { execSync, spawn } from 'node:child_process';
import net from 'node:net';

function log(section, msg) { console.log(`[${section}] ${msg}`); }

async function portInUse(port) {
  return new Promise(resolve => {
    const srv = net.createServer();
    srv.once('error', () => resolve(true));
    srv.once('listening', () => { srv.close(() => resolve(false)); });
    srv.listen(port, '127.0.0.1');
  });
}

function safeExec(cmd) {
  try { return execSync(cmd, { stdio: 'pipe' }).toString(); } catch (e) { return `ERROR: ${e.message}`; }
}

async function run() {
  log('env', `Node=${process.version}`);
  if (!process.env.DATABASE_URL) {
    log('warn', 'DATABASE_URL not set in environment (may still load from .env at runtime)');
  } else {
    log('env', 'DATABASE_URL present');
  }
  log('prisma', 'Checking prisma generate (no-op if already)');
  console.log(safeExec('npx prisma generate'));
  log('prisma', 'Migration status');
  console.log(safeExec('npx prisma migrate status'));
  const inUse = await portInUse(3000);
  log('network', `Port 3000 in use: ${inUse}`);
  if (inUse) {
    log('hint', 'If a zombie dev process exists, kill it or choose another port (set PORT env).');
  }
  log('next', 'Attempting to import next.config.mjs to detect syntax issues');
  try {
    await import('../next.config.mjs');
    log('next', 'next.config.mjs loaded OK');
  } catch (e) {
    log('error', 'Failed loading next.config.mjs: ' + e.message);
  }
  log('done', 'Diagnostic complete');
}

run();
