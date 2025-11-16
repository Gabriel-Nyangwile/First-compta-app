#!/usr/bin/env node
/**
 * Agrégateur tests PO: exécute successivement le flux complet (flow) puis les scénarios d'annulation.
 * - Prépare l'environnement: démarre le serveur Next si nécessaire (auto-start) et attend readiness.
 * - Ensuite exécute les deux scripts.
 */
import { spawn } from 'node:child_process';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
// Active l'auto-start sauf si NO_AUTO_START=1
const AUTO_START = process.env.NO_AUTO_START === '1' ? false : (process.env.START_DEV_IF_DOWN === '1' || true);
const DEBUG = process.env.DEBUG_PO_ALL === '1';
const MAX_TRIES = !isNaN(Number(process.env.PO_ALL_MAX_TRIES)) ? Number(process.env.PO_ALL_MAX_TRIES) : 50; // ~35s par défaut
const DELAY_MS = !isNaN(Number(process.env.PO_ALL_DELAY_MS)) ? Number(process.env.PO_ALL_DELAY_MS) : 700;

async function wait(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function isUpOnce(url){
  try { const r = await fetch(url, { cache: 'no-store' }); return r.ok; } catch { return false; }
}

function spawnDetachedDev(){
  // Plusieurs stratégies selon Windows / Unix
  const isWin = process.platform === 'win32';
  try {
    if (isWin) {
      // Utiliser cmd.exe /c pour éviter EINVAL dans certains environnements
      const child = spawn('cmd.exe', ['/c','npm','run','dev'], {
        detached: true,
        stdio: DEBUG ? 'inherit' : 'ignore',
        env: { ...process.env }
      });
      child.unref();
      return true;
    } else {
      const child = spawn('npm', ['run','dev'], {
        detached: true,
        stdio: DEBUG ? 'inherit' : 'ignore',
        env: { ...process.env }
      });
      child.unref();
      return true;
    }
  } catch (e) {
    console.log('[WARN] Auto-start spawn a échoué:', e.message);
    return false;
  }
}

async function ensureServer(){
  const healthCandidates = [ '/api/health', '/' ];
  // Sonde initiale
  for (const p of healthCandidates){ if (await isUpOnce(BASE+p)) { if(DEBUG) console.log('[DEBUG] Serveur déjà prêt.'); return; } }
  if (AUTO_START) {
    console.log('[INFO] Démarrage serveur (auto)...');
    const started = spawnDetachedDev();
    if (!started) console.log('[WARN] Auto-start non initié, essayer lancement manuel.');
  } else {
    console.log('[INFO] Auto-start désactivé. Lancer manuellement: npm run dev');
  }
  for (let i=1;i<=MAX_TRIES;i++) {
    for (const p of healthCandidates) {
      if (await isUpOnce(BASE+p)) {
        console.log(i>1 ? `[INFO] Serveur prêt (tentative ${i}).` : '[INFO] Serveur prêt.');
        // Petit délai supplémentaire pour laisser compiler les premières routes
        await wait(1000);
        return;
      }
    }
    if (i===1) console.log('[INFO] Attente disponibilité serveur...');
    await wait(DELAY_MS);
  }
  throw new Error(`Timeout readiness serveur après ${(MAX_TRIES*DELAY_MS/1000).toFixed(1)}s`);
}

const scripts = [
  { name: 'flow', cmd: ['node','scripts/test-purchase-order-flow.js'] },
  { name: 'cancel', cmd: ['node','scripts/test-purchase-order-cancel.js'] }
];

async function runSequential(){
  await ensureServer();
  let idx = 0;
  const runOne = () => {
    if (idx >= scripts.length) { console.log('\n✅ Tous les tests PO ont réussi'); return; }
    const s = scripts[idx++];
    console.log('\n=== RUN '+s.name.toUpperCase()+' ===');
    const childEnv = { ...process.env };
    // Désactiver auto-start dans les sous scripts (le serveur est déjà prêt)
    delete childEnv.START_DEV_IF_DOWN;
    const child = spawn(s.cmd[0], s.cmd.slice(1), { stdio: 'inherit', env: childEnv });
    child.on('exit', code => {
      if (code !== 0) { console.error('\n❌ Echec script', s.name, 'code', code); process.exit(code); }
      runOne();
    });
  };
  runOne();
}

runSequential().catch(e=>{ console.error('❌ Agrégateur tests PO échec:', e.message); process.exit(1); });
