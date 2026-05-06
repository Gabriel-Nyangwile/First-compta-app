# Inventaire des scripts

Inventaire phase 6 au 2026-05-04. Le repertoire `scripts/` contient 201 entrees, dont 196 scripts et 5 templates Excel d'ouverture.

## Synthese

| Famille | Nombre | Criticite dominante | Usage |
| --- | ---: | --- | --- |
| Admin | 2 | legacy / dangereux | suppressions admin ponctuelles |
| Audit | 15 | critique | controles metier et comptables |
| Backfill | 19 | correctif | migrations de donnees et rattrapages |
| Check / validate | 9 | utile | diagnostics rapides |
| Cleanup | 2 | correctif | nettoyage cible |
| Debug | 9 | legacy | inspection ad hoc |
| Dev | 3 | utile | aide locale |
| Export / restore | 11 | utile / correctif | sauvegardes et exports |
| Import | 9 | utile | imports comptes, journal, paie et ouverture |
| Ouverture | 3 | critique | templates, simulation et smoke ouverture |
| Paie | 36 | critique | tests, audits et smokes paie |
| Purge / reset | 6 | dangereux | nettoyage destructif |
| Rebuild / repair | 11 | correctif | regeneration et reparations comptables |
| Seed / create | 10 | utile | donnees de base et fixtures |
| Smoke | 3 | critique | sante applicative |
| Test | 40 | critique | tests de flux metier |
| Templates | 5 | utile | modeles Excel |
| Tools | 7 | legacy / utile | aides internes |
| Autre | 1 | critique | balance ledger |

## Scripts critiques exposes par npm

| Domaine | Commande |
| --- | --- |
| Packs | `npm run ops:packs`, `npm run audit:pack:quick`, `npm run audit:pack:accounting`, `npm run audit:pack:payroll`, `npm run audit:pack:treasury`, `npm run audit:pack:stock`, `npm run audit:pack:production`, `npm run audit:pack:multi-company`, `npm run audit:pack:opening` |
| Comptabilite | `npm run ledger:balance`, `npm run audit:invoice-balances`, `npm run audit:party-ids`, `npm run check:vat`, `npm run test:ledger-lettering`, `npm run test:lettering-flow` |
| Paie | `npm run audit:payroll-config`, `npm run audit:payroll:posting`, `npm run test:payroll:currency`, `npm run test:payroll:ipr`, `npm run test:payroll:post`, `npm run smoke:payroll:fully-settled`, `npm run smoke:payroll:lettering` |
| Tresorerie | `npm run test:money-movement`, `npm run test:treasury:recipe`, `npm run audit:supplier-payments`, `npm run audit:authorization:movements` |
| Stock | `npm run test:inventory-flow`, `npm run audit:stock`, `npm run audit:stock-withdrawals`, `npm run test:http:inventory` |
| Multi-societe | `npm run test:multi-company:all` |
| Ouverture / cloture | `npm run test:opening`, `npm run test:closing` |

## Inventaire complet par famille

### Admin

- `scripts/admin-delete-incoming-invoice.js`
- `scripts/admin-delete-test-personnel-and-future-periods.js`

### Audit

- `scripts/audit-authorization-movements.js`
- `scripts/audit-dangling-journal-sources.js`
- `scripts/audit-inventory-count.js`
- `scripts/audit-invoice-balances.js`
- `scripts/audit-journal-unbalanced.js`
- `scripts/audit-ledger-lettering.js`
- `scripts/audit-mission-advance-regularizations.js`
- `scripts/audit-multi-company.js`
- `scripts/audit-open-mission-advances.js`
- `scripts/audit-party-ids.js`
- `scripts/audit-payroll-posting.js`
- `scripts/audit-stock-withdrawals.js`
- `scripts/audit-stock.js`
- `scripts/audit-supplier-payments.js`
- `scripts/audit-treasury-employee-movements.js`

### Backfill

- `scripts/backfill-asset-po-invoice-link.js`
- `scripts/backfill-auditlog-company.js`
- `scripts/backfill-authorization-movements-transactions.js`
- `scripts/backfill-company-ids-lot5a.js`
- `scripts/backfill-company-ids-lot5b.js`
- `scripts/backfill-company-memberships.js`
- `scripts/backfill-company.js`
- `scripts/backfill-goods-receipt-putaway-staged-adjustments.js`
- `scripts/backfill-invoice-cancel.js`
- `scripts/backfill-invoice-paid-outstanding.js`
- `scripts/backfill-journal-entry.js`
- `scripts/backfill-line-links.js`
- `scripts/backfill-moneyaccount-ledgeraccounts.js`
- `scripts/backfill-movement-voucher-refs.js`
- `scripts/backfill-party-ids.js`
- `scripts/backfill-payroll-superseded-journals.js`
- `scripts/backfill-supplier-lettering.js`
- `scripts/backfill-transaction-lettering.js`
- `scripts/backfill-vat-multirate-add-only.js`

### Check / validate

- `scripts/analyze-invoice-numbers.js`
- `scripts/check-accounts.mjs`
- `scripts/check-employee-columns.js`
- `scripts/check-sources.js`
- `scripts/check-sources.mjs`
- `scripts/check-vat-ledger.js`
- `scripts/diagnose-line-links.js`
- `scripts/validate-rdc-payroll-config.js`
- `scripts/verify-prisma.js`

### Cleanup

- `scripts/cleanup-historical-empty-journals.js`
- `scripts/cleanup-test-mission-advance-data.js`

### Debug

- `scripts/debug-list-basic.js`
- `scripts/debug-open-payslip-page.js`
- `scripts/debug-payroll-period.js`
- `scripts/debug-supplier-payments.js`
- `scripts/describe-transaction.mjs`
- `scripts/find-assets-by-source.mjs`
- `scripts/inspect-unbalanced-and-orphans.mjs`
- `scripts/list-asset-related-ids.mjs`
- `scripts/show-xlsx-headers.mjs`

### Dev

- `scripts/dev-approve-last-draft-po-lite.js`
- `scripts/dev-approve-last-draft-po.js`
- `scripts/dev-diagnostic.js`

### Export / restore

- `scripts/backup-data.js`
- `scripts/export-asset-backup.mjs`
- `scripts/export-orphan-transactions-csv.mjs`
- `scripts/export-orphans-and-unbalanced.mjs`
- `scripts/export-post-backup.mjs`
- `scripts/export-transactions-company-csv.mjs`
- `scripts/export-transactions-csv.mjs`
- `scripts/export-trial-balance.js`
- `scripts/restore-backup-json.mjs`
- `scripts/restore-backup-models.mjs`
- `scripts/restore-transactions-from-backup.mjs`

### Import

- `scripts/import-accounts.js`
- `scripts/import-attendance.js`
- `scripts/import-journalentry-xlsx.mjs`
- `scripts/import-opening-ap.js`
- `scripts/import-opening-ar.js`
- `scripts/import-opening-assets.js`
- `scripts/import-opening-balance.js`
- `scripts/import-opening-stock.js`
- `scripts/import-payroll-variables.js`

### Ouverture

- `scripts/generate-opening-assets-simulation.js`
- `scripts/generate-opening-templates.js`
- `scripts/test-opening-imports.js`

### Paie

- `scripts/mark-expatriates.js`
- `scripts/payroll-settlement.js`
- `scripts/purge-payroll.js`
- `scripts/seed-payroll-config.js`
- `scripts/smoke-payroll-audit.js`
- `scripts/smoke-payroll-fully-settled.js`
- `scripts/smoke-payroll-inputs.js`
- `scripts/smoke-payroll-lettering.js`
- `scripts/smoke-payroll-liability-settlements.js`
- `scripts/smoke-payroll-overtime-post.js`
- `scripts/smoke-payroll-partial-state.js`
- `scripts/smoke-payroll-settlement.js`
- `scripts/smoke-payslip-pdf.js`
- `scripts/test-payroll-aen.js`
- `scripts/test-payroll-annual-summary-pdf.js`
- `scripts/test-payroll-annual-summary-xlsx.js`
- `scripts/test-payroll-annual-summary.js`
- `scripts/test-payroll-bonus.js`
- `scripts/test-payroll-cost-centers.js`
- `scripts/test-payroll-currency-pipeline.js`
- `scripts/test-payroll-expat-default-cc.js`
- `scripts/test-payroll-ipr.js`
- `scripts/test-payroll-lock.js`
- `scripts/test-payroll-period-summary-api.js`
- `scripts/test-payroll-period-summary-pdf.js`
- `scripts/test-payroll-period-summary-xlsx.js`
- `scripts/test-payroll-period-summary.js`
- `scripts/test-payroll-post.js`
- `scripts/test-payroll-reverse.js`
- `scripts/test-payroll-run-generate-lock.js`
- `scripts/test-payroll-run-preview-detail.js`
- `scripts/test-payroll-run-preview.js`
- `scripts/test-payroll-smoke.js`
- `scripts/test-payroll-trend.js`
- `scripts/test-payroll-years.js`
- `scripts/test-payslip-recalc.js`

### Purge / reset

- `scripts/purge-asset-data.mjs`
- `scripts/purge-capital.js`
- `scripts/purge-legacy-invoices.js`
- `scripts/purge-orphans.mjs`
- `scripts/purge-stock-domain.js`
- `scripts/reset-data.js`

### Rebuild / repair

- `scripts/fix-journal-unbalanced.js`
- `scripts/fix-orphan-payment.js`
- `scripts/fix-supplier-payment-links.js`
- `scripts/rebuild-capital-postings.js`
- `scripts/rebuild-empty-asset-journals.js`
- `scripts/rebuild-empty-journal-sources.js`
- `scripts/rebuild-journal.js`
- `scripts/rebuild-transactions-from-sources.js`
- `scripts/repair-empty-journals.js`
- `scripts/repost-capital-subscriptions.js`
- `scripts/revalue-inventory-cump.js`

### Seed / create

- `scripts/create-asset-category.mjs`
- `scripts/create-balanced-je-by-desc-date.mjs`
- `scripts/create-balanced-je-by-desc-only-dryrun.mjs`
- `scripts/create-balanced-je-by-desc-only.mjs`
- `scripts/ensure-default-company.mjs`
- `scripts/promote-platform-admin.js`
- `scripts/seed-cost-centers-nat-exp.js`
- `scripts/seed-fx-rates.js`
- `scripts/seed-minimal.js`
- `scripts/seed-phase-5-closing-demo.js`

### Smoke

- `scripts/smoke-assets.js`
- `scripts/smoke-health.js`
- `scripts/smoke-pdf.js`

### Test

- `scripts/regression-line-links.js`
- `scripts/test-capital-flow.js`
- `scripts/test-cash-purchase-vat.js`
- `scripts/test-client-invoice-pdf.js`
- `scripts/test-closing-annual.js`
- `scripts/test-fx-ipr-sanity.js`
- `scripts/test-http-inventory.js`
- `scripts/test-incoming-invoice-pdf.js`
- `scripts/test-inventory-flow.js`
- `scripts/test-ipr-sanity.js`
- `scripts/test-journal-integrity.js`
- `scripts/test-ledger-lettering.js`
- `scripts/test-lettering-flow.js`
- `scripts/test-mission-advance-refund.js`
- `scripts/test-mission-advance-regularization.js`
- `scripts/test-money-movement.js`
- `scripts/test-multi-company-isolation.js`
- `scripts/test-multi-company-onboarding-flow.js`
- `scripts/test-multi-company-runtime.js`
- `scripts/test-multirate-vat-pdf.js`
- `scripts/test-payment-flow.js`
- `scripts/test-pdf-both.js`
- `scripts/test-pdf.js`
- `scripts/test-personnel-summary-csv.js`
- `scripts/test-personnel-summary.js`
- `scripts/test-personnel-trend-csv.js`
- `scripts/test-personnel-trend-xlsx.js`
- `scripts/test-personnel-trend.js`
- `scripts/test-personnel.js`
- `scripts/test-phase-1.3b-02-services.js`
- `scripts/test-purchase-order-all.js`
- `scripts/test-purchase-order-cancel.js`
- `scripts/test-purchase-order-flow.js`
- `scripts/test-purchase-order-over-receipt.js`
- `scripts/test-release-multi-company.js`
- `scripts/test-return-order-flow.js`
- `scripts/test-return-order.js`
- `scripts/test-sales-order-invoice.js`
- `scripts/test-transfer.js`
- `scripts/test-treasury-recipe.js`

### Templates

- `scripts/templates/opening-ap-template.xlsx`
- `scripts/templates/opening-ar-template.xlsx`
- `scripts/templates/opening-assets-template.xlsx`
- `scripts/templates/opening-balance-template.xlsx`
- `scripts/templates/opening-stock-template.xlsx`

### Tools

- `scripts/alias-loader.mjs`
- `scripts/apply-manual-groups.mjs`
- `scripts/assign-accounts-company.mjs`
- `scripts/attach-orphans-by-je.mjs`
- `scripts/auto-attach-orphans.mjs`
- `scripts/auto-group-orphans.mjs`
- `scripts/rename-asset-source.mjs`

### Autre

- `scripts/ledger-balance.js`
