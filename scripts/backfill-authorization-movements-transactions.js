#!/usr/bin/env node
/**
 * Backfill script: crée les écritures comptables manquantes pour les mouvements
 * générés via des autorisations (treasuryAuthorization) avant l'introduction
 * d'autoPostTransactions dans executeAuthorizationViaMovement.
 *
 * Stratégie:
 * 1. Trouver tous les mouvements liés à une authorization (authorizationId != null)
 *    qui n'ont AUCUNE transaction (transactions count = 0).
 * 2. Pour chaque mouvement, reconstruire les écritures en ré-appliquant la logique
 *    d'autoPostTransactions (copiée / importée depuis money serverActions) selon kind / direction.
 * 3. Mettre à jour également les statuts facture / facture fournisseur si applicable.
 *
 * Sécurité: transaction par mouvement pour éviter un blocage global.
 */
import prisma from '../src/lib/prisma.js';
import { Prisma } from '@prisma/client';
import { ensureLedgerAccountForMoneyAccount, autoPostTransactions, updateInvoiceSettlementStatus, updateIncomingInvoiceSettlementStatus } from '../src/lib/serverActions/money.js';

async function main() {
  console.log('[backfill] Recherche des mouvements autorisation sans transactions…');
  const candidates = await prisma.moneyMovement.findMany({
    where: {
      authorizationId: { not: null },
      transactions: { none: {} }
    },
    include: { moneyAccount: { include: { ledgerAccount: true } } }
  });
  if (!candidates.length) {
    console.log('[backfill] Aucun mouvement à régulariser. ✓');
    return;
  }
  console.log(`[backfill] ${candidates.length} mouvement(s) à régulariser.`);
  let fixed = 0, errors = 0;
  for (const mv of candidates) {
    try {
      await prisma.$transaction(async (tx) => {
        let moneyAccount = mv.moneyAccount;
        if (!moneyAccount.ledgerAccountId) {
          const { account } = await ensureLedgerAccountForMoneyAccount(moneyAccount);
          moneyAccount = await tx.moneyAccount.findUnique({ where: { id: moneyAccount.id }, include: { ledgerAccount: true } });
          moneyAccount.ledgerAccountId = account.id;
        }
        await autoPostTransactions({
          tx,
          movement: mv,
          moneyAccount,
          amount: mv.amount,
          direction: mv.direction,
          kind: mv.kind,
          invoiceId: mv.invoiceId,
          incomingInvoiceId: mv.incomingInvoiceId
        });
        if (mv.invoiceId) await updateInvoiceSettlementStatus(tx, mv.invoiceId);
        if (mv.incomingInvoiceId) await updateIncomingInvoiceSettlementStatus(tx, mv.incomingInvoiceId);
      });
      fixed++;
      console.log(`[backfill] OK mouvement ${mv.id}`);
    } catch (e) {
      errors++;
      console.error(`[backfill] ERREUR mouvement ${mv.id}:`, e.message);
    }
  }
  console.log(`[backfill] Terminé. Corrigés=${fixed}, Erreurs=${errors}`);
  if (errors > 0) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exit(1); });
