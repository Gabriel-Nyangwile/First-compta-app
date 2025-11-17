#!/usr/bin/env node
/**
 * Test basique génération PDF :
 * - Télécharge une facture client ou fournisseur
 * - Vérifie en-tête %PDF-
 * - Cherche présence SIRET ou watermark BROUILLON (si demandé)
 * - Détecte motifs multi-taux TVA (ex: "Base (20%)" / "TVA  (20%)")
 * - Vérifie présence éventuelle de la police embarquée (nom Inter si utilisée)
 *
 * Usage:
 *  node scripts/test-pdf.js --id=<uuid> [--type=incoming] [--expect-draft]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (const a of args) {
    if (a.startsWith('--id=')) opts.id = a.split('=')[1];
    else if (a === '--type=incoming') opts.incoming = true;
  else if (a === '--expect-draft') opts.expectDraft = true;
  else if (a === '--expect-multi-vat') opts.expectMultiVat = true;
  }
  return opts;
}

async function main() {
  const { id, incoming, expectDraft, expectMultiVat } = parseArgs();
  if (!id) {
    console.log('[SKIP] test-pdf: no --id provided; skipping.');
    process.exit(0);
  }
  const base = process.env.BASE_URL || 'http://localhost:3000';
  const url = incoming
    ? `${base}/api/incoming-invoices/${id}/pdf`
    : `${base}/api/invoice/${id}/pdf`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error('HTTP error', res.status, await res.text());
    process.exit(2);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.slice(0, 5).toString().startsWith('%PDF-')) {
    console.error('Not a PDF file. Magic header mismatch.');
    process.exit(3);
  }
  const txtSample = buf.toString('latin1'); // pdf texte non fiabilisé mais suffisant pour simple détection

  const companyMarker = (process.env.COMPANY_SIRET || '000 000 000 00000').split(' ')[0];
  const hasSiret = txtSample.includes(companyMarker) || txtSample.includes('SIRET');
  if (!hasSiret) {
    console.warn('WARN: marqueur SIRET non trouvé (possible compression / encoding).');
  }

  if (expectDraft) {
    if (!/BROUILLON/.test(txtSample)) {
      console.error('Watermark BROUILLON attendu mais absent');
      process.exit(4);
    }
  }

  let multiVatDetected = false;
  if (/Base \(\d{1,2}%\)/.test(txtSample) && /TVA  \(\d{1,2}%\)/.test(txtSample)) {
    multiVatDetected = true;
  }
  if (expectMultiVat && !multiVatDetected) {
    console.error('Multi-taux TVA attendu mais motifs non trouvés');
    process.exit(5);
  }

  const fontEmbedded = /Inter|Helvetica/i.test(txtSample);

  console.log('PDF OK', { bytes: buf.length, url, hasSiret, draft: expectDraft || false, multiVatDetected, fontEmbedded });
  const outDir = path.join(__dirname, '..', 'tmp');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const outPath = path.join(outDir, `pdf-test-${incoming ? 'incoming' : 'client'}-${id}.pdf`);
  fs.writeFileSync(outPath, buf);
  console.log('Sauvegardé:', outPath);
}

main().catch(e => { console.error(e); process.exit(99); });
