# Guide d'exploitation technique

Ce guide couvre la phase 6 de finalisation : scripts, audits reproductibles et usage operateur.

## 1. Pre-requis

- Se placer a la racine du projet.
- Avoir `.env.local` renseigne avec `DATABASE_URL`.
- Avoir lance `npm install`, `npx prisma generate` et les migrations locales.
- Renseigner `DEFAULT_COMPANY_ID` pour les audits qui ciblent une societe precise.

Les scripts destructifs ou correctifs doivent etre executes seulement apres sauvegarde :

```bash
npm run backup:data
```

## 2. Packs d'audit

Les packs sont exposes par `scripts/run-audit-pack.js` et appellent les scripts npm existants dans un ordre stable.

```bash
npm run ops:packs
npm run audit:pack:quick
npm run audit:pack:accounting
npm run audit:pack:payroll
npm run audit:pack:treasury
npm run audit:pack:stock
npm run audit:pack:production
npm run audit:pack:multi-company
npm run audit:pack:opening
```

Suites CI/release :

```bash
npm run ci:quick
npm run ci:full
```

`ci:quick` est la gate GitHub Actions courte : lint, validation Prisma, pack rapide et build. `ci:full` ajoute les packs metier longs et reste une validation manuelle avant release.

La decision finale de livraison est formalisee dans [release-checklist.md](./release-checklist.md).

Options du runner :

```bash
node --env-file=.env.local scripts/run-audit-pack.js accounting --dry-run
node --env-file=.env.local scripts/run-audit-pack.js accounting --continue-on-error
```

## 3. Packs recommandes

| Pack | Quand l'utiliser | Commande |
| --- | --- | --- |
| Rapide | controle quotidien ou avant commit local | `npm run audit:pack:quick` |
| Comptabilite | apres changement journal, facture, lettrage ou TVA | `npm run audit:pack:accounting` |
| Paie | apres changement de calcul, posting, reglement ou PDF paie | `npm run audit:pack:payroll` |
| Tresorerie | apres changement mouvements, paiements, avances ou autorisations | `npm run audit:pack:treasury` |
| Stock | apres changement achat, reception, retour, sortie ou CUMP | `npm run audit:pack:stock` |
| Production | apres changement nomenclature, ordre de fabrication, consommation ou entree produit fini | `npm run audit:pack:production` |
| Multi-societe | apres changement scoping, RBAC societe ou onboarding | `npm run audit:pack:multi-company` |
| Ouverture | apres changement reprises, cloture annuelle ou verrouillage exercice | `npm run audit:pack:opening` |

## 3.1 Suite courte vs suite complete

| Suite | Commande | Usage |
| --- | --- | --- |
| Courte | `npm run ci:quick` | CI automatique, validation avant push, feedback rapide |
| Complete | `npm run ci:full` | Gate release ou validation avant deploiement important |
| Domaine | `npm run audit:pack:<domaine>` | Correction ciblee apres changement metier |

## 4. Regles d'usage CLI

Les nouveaux scripts doivent suivre ces conventions :

| Besoin | Option standard |
| --- | --- |
| Cibler une societe | `--companyId <id>` pour les audits/backfills generiques, `--company <id>` seulement pour les imports d'ouverture existants |
| Simulation | `--dry-run` |
| Application explicite | `--apply` |
| Correction d'audit | `--fix` |
| Continuer malgre un ecart connu | `--no-exit-error` |
| Details lisibles | `--details` ou `--verbose` |
| Cibler une periode paie | `--ref=PP-000000` |
| Cibler toutes les societes ou periodes | `--all` |

Par defaut, un script qui peut modifier les donnees doit simuler ou refuser l'execution tant que `--apply`, `--fix`, `--force` ou une variable de confirmation documentee n'est pas fournie.

## 5. Criticite des scripts

| Niveau | Definition | Exemples |
| --- | --- | --- |
| Critique | Controle ou smoke a lancer avant livraison ou apres changement financier | `ledger-balance.js`, `audit-invoice-balances.js`, `test-inventory-flow.js`, `audit-payroll-posting.js` |
| Utile | Outil d'investigation, seed, import controle ou verification ponctuelle | `dev-diagnostic.js`, `export-trial-balance.js`, `generate-opening-templates.js` |
| Correctif | Backfill, rebuild ou reparation avec impact potentiel sur les donnees | `backfill-journal-entry.js`, `rebuild-journal.js`, `audit-stock.js --fix` |
| Legacy / debug | Script historique, diagnostic ad hoc ou suppression admin | `debug-*`, `admin-*`, `purge-*`, scripts orphelins |

Le catalogue complet est dans [scripts-inventory.md](./scripts-inventory.md).

## 6. Procedure avant correction

1. Executer le pack d'audit du domaine.
2. Exporter ou sauvegarder les donnees concernees.
3. Relancer le script correctif en `--dry-run` quand l'option existe.
4. Executer avec `--apply` ou `--fix` uniquement si le rapport est compris.
5. Relancer le meme pack d'audit.
6. Noter la commande et le resultat dans le ticket ou le journal d'exploitation.

## 7. Nettoyage et legacy

Aucun script legacy n'est supprime automatiquement dans cette phase. Les scripts classes `Legacy / debug` restent disponibles, mais ne doivent pas etre ajoutes a un pack d'audit sans revue. Un script peut etre supprime seulement apres verification qu'il n'est reference ni par `package.json`, ni par une documentation, ni par une procedure de reprise.

## 8. Registre des scripts dangereux

Decisions phase 6 :

| Famille | Statut | Regle d'exploitation |
| --- | --- | --- |
| `admin-*` | Legacy conserve | Suppression ponctuelle uniquement, apres backup et controle du scope. |
| `purge-*` / `reset-data.js` | Dangereux conserve | Interdit dans CI et packs d'audit. Ne pas executer contre Neon/Vercel sans procedure explicite. |
| `debug-*` | Candidat retrait differe | Lecture seule ou inspection ad hoc; ne pas promouvoir en npm script sans besoin durable. |
| `fix-*`, `repair-*`, `rebuild-*` | Correctif conserve | Toujours commencer par dry-run quand disponible, puis relancer le pack du domaine. |

Scripts correctifs recents valides :

```bash
npm run stock:reconcile
npm run repair:cross-company-transaction-accounts
```

Les decisions detaillees sont maintenues dans [scripts-inventory.md](./scripts-inventory.md#revue-legacy--dangereux-du-2026-05-12).
