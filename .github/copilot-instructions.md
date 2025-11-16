# Instructions Copilot (Guide Focalisé)

Patrons concis et actionnables pour qu’un agent IA soit immédiatement productif (comptabilité + stock + trésorerie). Éviter les refontes larges ; respecter les conventions existantes.

## 1. Vue d’Ensemble

App Next.js (App Router) + Prisma/PostgreSQL couvrant : factures clients & fournisseurs, journal (partie double), trésorerie (mouvements, autorisations, avis bancaires), achats (PO + réception), stock & valorisation (CUMP), génération PDF unifiée. Schéma: `prisma/schema.prisma`. Logique métier: `src/lib/**`. API REST: `src/app/api/<resource>/route.js`. Server Actions uniquement pour anciens fetch/mutate composites (`src/lib/serverActions/`).

## 2. Essentiels Architecture / Métier

- Prisma unique : toujours importer depuis `src/lib/prisma.js`.
- Numérotation séquentielle : `nextSequence(prisma, name, prefix)` (zéro‑pad 6). Utilisé pour factures, PO, réceptions, voucherRef mouvements trésorerie, écritures journal (`JRN-`). Pas de compteur ad‑hoc.
- Statut dérivé OVERDUE calculé (status PENDING + dueDate passée) — JAMAIS stocké.
- Décimaux monétaires : convertir `Decimal` via `value?.toNumber?.() ?? 0` avant calcul / JSON.
- TVA : récupérer comptes système via `getSystemAccounts()` (445700 collectée, 445660 déductible). Ne pas recréer.
- Valorisation stock : maintenir coût moyen (CUMP) dans `revalueInventory.js` / `inventory.js` pour tout mouvement affectant le stock.
- Facture fournisseur : n’autoriser la création liée à un BC que lorsque toutes les lignes sont reçues (`PurchaseOrder.status === 'RECEIVED'` ou `CLOSED`).

## 3. Pipeline PDF Unifiée

Générateur serveur unique multi‑pages pour factures client & fournisseur. Scripts de vérif : `smoke-pdf.js`, `test-multirate-vat-pdf.js`. Support : multi-taux TVA récap, watermark BROUILLON, bloc identité société. ENV : `COMPANY_NAME`, `COMPANY_ADDRESS` (\n), `COMPANY_SIRET`, `COMPANY_VAT`, optionnel `PDF_FONT_PATH`. Toujours valider avec smoke (en-tête `%PDF-`).

## 4. Scripts Clés (Cycle & Intégrité)

- Initialisation / seed : `verify-prisma.js`, `import-accounts.js`, `seed-minimal.js`.
- Backfills : `backfill-invoice-paid-outstanding.js`, `backfill-journal-entry.js`, `backfill-vat-multirate-add-only.js`, `backfill-line-links.js`.
- Valorisation : `revalue-inventory-cump.js`.
- Intégrité / audits : `audit-invoice-balances.js`, `ledger-balance.js`, `audit-ledger-lettering.js`, `regression-line-links.js`, `test-journal-integrity.js`, `test-inventory-flow.js`, `test-money-movement.js`, `test-ledger-lettering.js`.
- Rebuild journal : `rebuild-journal.js` (balances uniquement) après changement schéma / règles de poste.

## 5. Règles Journal / Postings

- Créer toutes les `Transaction` puis appeler `finalizeBatchToJournal` (même transaction Prisma) pour produire une `JournalEntry` équilibrée (`JRN-######`).
- Invariant : Σ débit = Σ crédit ; échec = ligne manquante (TVA / client / fournisseur / stock).
- Nouveaux postings : étendre les enums, ne pas recycler un kind existant.

## 6. Checklist Implémentation Fonction

1. Étendre schéma si nécessaire → `npx prisma migrate dev`.
2. Ajouter / modifier route API (`src/app/api/<ressource>/route.js`) avec seuls verbes requis.
3. Utiliser `nextSequence` pour toute nouvelle référence externe / voucher.
4. Convertir Decimals, calculer OVERDUE transitoire, normaliser dates (heure 00:00).
5. Si impact stock / trésorerie : mouvements + valorisation + postings journal cohérents.
6. Ajouter/adapter un script smoke ou test reflétant la nouvelle règle métier (ex : `npm run test:ledger-lettering` après toute évolution touchant le lettrage).

## 7. Conventions & Pièges

- Préfixes scripts : backfill-, audit-, smoke-, test- (viser idempotence).
- Ne PAS recréer l’ancien chemin navbar `src/components/NavbarDropdown.jsx`; utiliser `src/components/navbar/`.
- Pas de refactor de style massif ; diffs centrés métier.
- Toujours étendre enums (ex: `MoneyMovementKind`) plutôt que renommer.

## 8. Fichiers Référence Rapide

`prisma/schema.prisma` (modèles & enums) • `src/lib/sequence.js` (numérotation) • `src/lib/systemAccounts.js` (comptes TVA) • `src/lib/revalueInventory.js` & `src/lib/inventory.js` (CUMP) • `src/lib/journal.js` (finalisation) • `src/lib/serverActions/clientAndInvoice.js` (legacy) • `scripts/*` (ops & intégrité).

## 9. Porte de Sécurité (Safe Gate)

Après modification impactante : `verify-prisma.js` → migration → `smoke-health.js` → script test représentatif (`test-inventory-flow.js`, `test-journal-integrity.js`, `test-ledger-lettering.js`) → audits (`audit-invoice-balances.js`, `ledger-balance.js`, `audit-ledger-lettering.js`) si impact financier ou lettrage.

---

Besoin d’un approfondissement (mapping stock, TVA multi-taux interne, rebuild journal) ? Précisez et ce guide sera étendu.
