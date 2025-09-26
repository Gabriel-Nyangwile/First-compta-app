#!/usr/bin/env node
/**
 * Purge des anciennes factures legacy.
 * Formats supportés :
 *   1) INV-YYYY-#### (pattern historique) => mode "hyphen"
 *   2) INV-############ (INV- + 8 à 12 digits sans second tiret) => mode "compact"
 *
 * Sélection du mode :
 *   --mode=hyphen (par défaut)
 *   --mode=compact
 *   --mode=all  (combine les deux)
 *
 * Sécurité :
 *  - Dry-run par défaut (aucune suppression) -> afficher ce qui serait supprimé.
 *  - Pour exécuter réellement: ajouter l'argument --execute
 *  - Peut restreindre par année: --year=2024 (uniquement pertinent pour mode hyphen ou all)
 *  - Option --limit=N pour tester sur N factures seulement (ordre par issueDate asc)
 *  - Option --verbose pour afficher les transactions
 *  - Option --export=chemin.json pour exporter un rapport JSON (toujours possible en dry-run, recommandé avant --execute)
 *  - Option --force pour supprimer sans confirmation interactive (sinon prompt si stdin TTY)
 *
 * Effets :
 *  - Supprime transactions liées (Transaction.invoiceId)
 *  - Supprime lignes (InvoiceLine)
 *  - Supprime la facture (Invoice)
 *  - Ne touche pas aux clients / comptes
 *
 * Journalisation :
 *  - Résumé global des montants (débits, crédits) des transactions supprimées
 *  - Listing des numéros
 */

import fs from 'fs';
import readline from 'readline';
import prisma from '../src/lib/prisma.js';

function parseArgs() {
  // When invoked via npm run, arguments after -- are preserved; process.argv includes node + script path.
  const args = process.argv.slice(2);
  const opts = { execute: false, year: null, limit: null, verbose: false, mode: 'hyphen', exportPath: null, force: false, debug: false, pattern: null, prefix: null, numbers: [] };
  for (const a of args) {
    if (a === '--execute') opts.execute = true;
    else if (a === '--verbose') opts.verbose = true;
    else if (a.startsWith('--year=')) opts.year = a.split('=')[1];
    else if (a.startsWith('--limit=')) opts.limit = parseInt(a.split('=')[1], 10) || null;
    else if (a.startsWith('--mode=')) opts.mode = a.split('=')[1];
    else if (a.startsWith('--export=')) opts.exportPath = a.split('=')[1];
    else if (a === '--force') opts.force = true;
    else if (a === '--debug') opts.debug = true;
  else if (a.startsWith('--pattern=')) opts.pattern = a.substring(10);
    else if (a.startsWith('--prefix=')) opts.prefix = a.substring(9);
  else if (a.startsWith('--numbers=')) opts.numbers = a.substring(10).split(',').map(s=>s.trim()).filter(Boolean);
    else if (a === '--help') {
  console.log(`Usage: node scripts/purge-legacy-invoices.js [--execute] [--mode=hyphen|compact|all] [--year=YYYY] [--limit=N] [--verbose] [--export=report.json] [--force] [--debug] [--pattern=REGEX] [--prefix=STR] [--numbers=inv1,inv2]\n`);
      process.exit(0);
    }
  }
  return opts;
}

function matchHyphen(invNumber, yearFilter) {
  const m = /^INV-(\d{4})-(\d{4,})$/.exec(invNumber || '');
  if (!m) return false;
  if (yearFilter && m[1] !== String(yearFilter)) return false;
  return true;
}

function matchCompact(invNumber) {
  // INV- + 8 à 15 digits (sans second tiret). Extension pour couvrir variantes.
  return /^INV-\d{8,15}$/.test(invNumber || '');
}

function isTargetInvoice(invNumber, mode, yearFilter, customPattern, prefix) {
  if (customPattern) {
    try {
      const re = new RegExp(customPattern);
      if (!re.test(invNumber || '')) return false;
    } catch (e) {
      console.error('Regex invalide pour --pattern:', e.message);
      return false;
    }
  }
  if (prefix) {
    if (!invNumber || !invNumber.startsWith(prefix)) return false;
  }
  if (mode === 'hyphen') return matchHyphen(invNumber, yearFilter);
  if (mode === 'compact') return matchCompact(invNumber);
  if (mode === 'all') return matchHyphen(invNumber, yearFilter) || matchCompact(invNumber);
  return false;
}

(async () => {
  const { execute, year, limit, verbose, mode, exportPath, force, debug, pattern, prefix, numbers } = parseArgs();
  console.log(`\n=== Purge Legacy Invoices (mode: ${mode}) ===`);
  console.log(`Mode: ${execute ? 'EXECUTION (suppression définitive)' : 'DRY-RUN'}\n`);
  if (year) {
    if (mode === 'compact') {
      console.log('Avertissement: --year ignoré en mode compact (pas d\'année encodée).');
    } else {
      console.log(`Filtre année : ${year}`);
    }
  }

  // Récupération des factures candidates (sélection minimale de champs)
  const candidates = await prisma.invoice.findMany({
    select: { id: true, invoiceNumber: true, issueDate: true },
    orderBy: { issueDate: 'asc' }
  });

  let legacy = candidates.filter(i => isTargetInvoice(i.invoiceNumber, mode, year, pattern, prefix));
  if (numbers.length) {
    const set = new Set(numbers);
    legacy = candidates.filter(i => set.has(i.invoiceNumber));
    console.log(`Filtrage explicite --numbers actif (${numbers.length} valeurs fournies).`);
  }
  if (debug) {
    const total = candidates.length;
    const examples = { hyphen: [], compact: [], other: [] };
    for (const c of candidates.slice(0,500)) { // limit sample
      if (matchHyphen(c.invoiceNumber)) examples.hyphen.push(c.invoiceNumber);
      else if (matchCompact(c.invoiceNumber)) examples.compact.push(c.invoiceNumber);
      else if (c.invoiceNumber && c.invoiceNumber.startsWith('INV-')) examples.other.push(c.invoiceNumber);
    }
    console.log(`Debug: invoices scanned=${total}`);
    console.log(`Debug: sample hyphen matches: ${examples.hyphen.slice(0,5).join(', ')}`);
    console.log(`Debug: sample compact matches: ${examples.compact.slice(0,5).join(', ')}`);
    console.log(`Debug: sample other INV-* (non matched): ${examples.other.slice(0,5).join(', ')}`);
  }
  const target = limit ? legacy.slice(0, limit) : legacy;

  if (!target.length) {
    console.log('Aucune facture legacy correspondante.');
    if (debug) {
      const invPrefixes = candidates.filter(c=> (c.invoiceNumber||'').startsWith('INV-')).slice(0,20).map(c=>c.invoiceNumber);
      console.log('Echantillon INV-* disponibles:', invPrefixes.join(', '));
    }
    process.exit(0);
  }

  console.log(`Factures legacy détectées (pattern ${mode}): ${legacy.length} (ciblées cette exécution: ${target.length})`);

  let totalDebit = 0, totalCredit = 0, invoiceCount = 0, txCount = 0;
  const report = [];

  for (const inv of target) {
    const txs = await prisma.transaction.findMany({ where: { invoiceId: inv.id } });
    const lines = await prisma.invoiceLine.findMany({ where: { invoiceId: inv.id } });

    const debitSum = txs.filter(t => t.direction === 'DEBIT').reduce((s, t) => s + Number(t.amount), 0);
    const creditSum = txs.filter(t => t.direction === 'CREDIT').reduce((s, t) => s + Number(t.amount), 0);
    totalDebit += debitSum; totalCredit += creditSum; invoiceCount += 1; txCount += txs.length;

    console.log(`\n# ${inv.invoiceNumber} (${inv.id}) - issueDate=${inv.issueDate.toISOString().slice(0,10)}\n  Lignes: ${lines.length} | Transactions: ${txs.length} | ΣDebit=${debitSum.toFixed(2)} | ΣCredit=${creditSum.toFixed(2)}`);
    if (verbose) {
      for (const t of txs) {
        console.log(`   - TX ${t.id} ${t.kind} ${t.direction} ${Number(t.amount).toFixed(2)} acc=${t.accountId}`);
      }
    }

    report.push({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate.toISOString(),
      lineCount: lines.length,
      transactionCount: txs.length,
      debitSum: Number(debitSum.toFixed(2)),
      creditSum: Number(creditSum.toFixed(2)),
      net: Number((debitSum - creditSum).toFixed(2)),
      transactions: verbose ? txs.map(t => ({ id: t.id, kind: t.kind, direction: t.direction, amount: Number(t.amount), accountId: t.accountId })) : undefined
    });

    if (execute) {
      // Suppressions différées après confirmation globale (on stocke d'abord le report)
    }
  }

  console.log('\n=== Récapitulatif ===');
  console.log(`Factures traitées : ${invoiceCount}`);
  console.log(`Transactions traitées : ${txCount}`);
  console.log(`Σ Débits supprimés potentiels : ${totalDebit.toFixed(2)}`);
  console.log(`Σ Crédits supprimés potentiels : ${totalCredit.toFixed(2)}`);
  console.log(`Impact net (Debit - Credit) : ${(totalDebit - totalCredit).toFixed(2)}`);

  if (exportPath) {
    try {
      fs.writeFileSync(exportPath, JSON.stringify({
        mode,
        yearFilter: year || null,
        generatedAt: new Date().toISOString(),
        invoiceTotal: invoiceCount,
        transactionTotal: txCount,
        sumDebit: Number(totalDebit.toFixed(2)),
        sumCredit: Number(totalCredit.toFixed(2)),
        netImpact: Number((totalDebit - totalCredit).toFixed(2)),
        invoices: report
      }, null, 2));
      console.log(`\nRapport JSON écrit: ${exportPath}`);
    } catch (e) {
      console.error('Erreur écriture export JSON:', e);
    }
  }

  if (execute) {
    if (!force && process.stdin.isTTY) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await new Promise(res => rl.question('Confirmer suppression irréversible (oui/n) ? ', res));
      rl.close();
      if (!/^o(ui)?$/i.test(answer.trim())) {
        console.log('Annulé par utilisateur.');
        await prisma.$disconnect();
        return;
      }
    }
    console.log('\nSuppression en cours...');
    for (const r of report) {
      await prisma.transaction.deleteMany({ where: { invoiceId: r.invoiceId } });
      await prisma.invoiceLine.deleteMany({ where: { invoiceId: r.invoiceId } });
      await prisma.invoice.delete({ where: { id: r.invoiceId } });
    }
    console.log('Suppression terminée.');
  } else {
    console.log('\n(Aucune suppression effectuée - relancer avec --execute pour appliquer)');
  }

  await prisma.$disconnect();
})().catch(e => {
  console.error('Erreur purge legacy invoices:', e);
  process.exit(1);
});
