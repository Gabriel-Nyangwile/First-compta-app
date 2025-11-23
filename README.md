# First Compta

## Project Title

[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-pending-lightgrey)](#coverage)
[![Latest Release](https://img.shields.io/github/v/release/Gabriel-Nyangwile/first-compta?display_name=tag&sort=semver)](https://github.com/Gabriel-Nyangwile/first-compta/releases)

Lightweight double-entry accounting kernel (invoices, ledger transactions, VAT) built with Next.js App Router + Prisma. (Version française : voir `README.fr.md`).

## 1. Overview

This project implements a minimal but extensible accounting layer for sales invoices inside a modern React (Next.js) stack:

- Double-entry postings (receivable, revenue, VAT collected)
- Transaction ledger with directional debits/credits and semantic kinds
- Invoice lifecycle: draft → issued → paid (via settlement postings)
- CSV export & filtering for transactions
- Client management (CRUD) with per-client receivable account link
- Autocomplete for accounts & clients (search + inline create)

The current scope focuses on sales (customers). A supplier / purchase module will follow (see Roadmap).

Full functional / technical details of accounting logic live in: [docs/accounting.md](./docs/accounting.md)

## 2. Tech Stack & Architecture

| Layer | Technology | Notes |
|-------|------------|-------|
| UI / Routing | Next.js (App Router, React 19) | Server + Client components mixed |
| Data Access | Prisma (PostgreSQL) | Strongly typed models & migrations |
| Auth (temporary) | Lightweight localStorage + custom DOM events | Simplified dev-only approach (no sessions / JWT) |
| PDF | Server-side pdf-lib (multi-page) | Unified generation for client & supplier invoices (pagination + headers/footers) |
| Validation | Central helper (`lib/validation/client.js`) | Normalization & controlled enums |

### 2.1 Frontend

Pages live under `src/app/` following the App Router conventions. Reusable UI sits in `src/components/`.

Key screens:

- `/invoices` list & creation page
- `/invoices/[id]` invoice detail (with PDF download)
- `/clients` list, create, edit flows
- `/transactions` ledger & CSV export

### 2.2 Backend (API Routes)

API endpoints are colocated under `src/app/api/*`. Each resource uses RESTful semantics (GET, POST, PUT, DELETE) per route folder.

### 2.3 Data Flow (Invoice Creation)

1. User submits invoice form (lines referencing account numbers)
1. API validates + writes `Invoice` & `InvoiceLine` records
1. Accounting postings generated:

- Debit client receivable (411*)
- Credit sales revenue (aggregated lines)
- Credit VAT collected (4457*) if applicable

1. Response returns the persisted invoice with generated number.

### 2.4 Settlement Flow

Payment triggers settlement endpoint → posts:

- Debit bank / cash account (512 / 53… planned; placeholder currently)
- Credit client receivable

Invoice status moves to PAID when balance is zero.

## 3. Data Model (Prisma Summary)

Core models (abridged — see `prisma/schema.prisma` for authoritative schema):

- `Client`: basic identity data + category + related receivable `Account`
- `Account`: generic chart-of-accounts entry (number, name, optional relations)
- `Invoice`: header (client, status, issueDate, total amounts)
- `InvoiceLine`: references revenue / VAT accounts and amount bases
- `Transaction`: single posting line with `direction` (DEBIT|CREDIT) & `kind` (semantic enum)

Important enums:

- `TransactionDirection`: DEBIT / CREDIT
- `TransactionKind`: e.g. INVOICE_RECEIVABLE, INVOICE_SALES, INVOICE_VAT_COLLECTED, PAYMENT_RECEIVABLE_CLEARING (names may evolve)
- `ClientCategory`: categorization for payment term logic

## 4. Accounting Flows (Sales)

Detailed logic in [docs/accounting.md](./docs/accounting.md). High-level recap:

| Scenario | Postings | Notes |
|----------|----------|-------|
| Issue invoice | DR Receivable / CR Sales / CR VAT | Sales aggregated per revenue accounts |
| Settlement (full) | DR Bank / CR Receivable | Marks invoice PAID |
| Settlement (partial, future) | DR Bank / CR Receivable (partial) | Status logic will handle PARTIAL |

Double-entry invariants: Σ Debit = Σ Credit for every operation group.

## 5. Validation & Helpers

Centralized in `lib/validation/client.js`:

- `normalizeEmail(email)` → lowercases & trims
- `validateCategory(category)` → ensures value is in `VALID_CLIENT_CATEGORIES`
- `getPaymentDays(category)` → maps category to default payment term

Applied in `POST /api/clients` and `PUT /api/clients/[id]` to maintain consistency (unicité email + logique de catégorie).

## 6. API Reference (Current)

Base path: `/api`

| Endpoint | Method(s) | Purpose |
|----------|-----------|---------|
| `/accounts/search` | GET | Autocomplete chart of accounts by prefix |
| `/account/create` | POST | Create a new account |
| `/clients` | GET, POST | List or create clients |
| `/clients/search` | GET | Name-based search (autocomplete) |
| `/clients/[id]` | GET, PUT, DELETE | Retrieve, update, or delete a client (with orphan account cleanup) |
| `/invoices` | GET, POST | List or create invoices |
| `/invoices/next-number` | GET | Fetch next sequential invoice number |
| `/invoice/[id]/pdf` | GET | Generate PDF (pdf-lib) for a client invoice (lines, HT/TVA/TTC) |
| `/incoming-invoices/[id]/pdf` | GET | Generate PDF (pdf-lib) for a supplier (incoming) invoice |
| `/transactions` | GET | Filtered ledger list + aggregates + CSV support |

Example: create client

```http
POST /api/clients
Content-Type: application/json
{
  "name": "Acme SARL",
  "email": "contact@acme.fr",
  "category": "STANDARD",
  "address": "12 Rue Exemple, 75000 Paris"
}
```

Returns 201 with JSON client payload (email normalized, receivable account created if needed).

Error modes:

- 400 invalid category
- 409 email already exists (normalized comparison)

## 7. Development Workflow

### 7.1 Prerequisites

- Node.js 18+
- PostgreSQL instance

### 7.2 Setup

```bash
npm install
npx prisma migrate dev
node scripts/import-accounts.js   # load chart of accounts (plan comptable)
npm run dev
```

Visit <http://localhost:3000>

### 7.3 Useful Commands

```bash
# Start development server
npm run dev
# Apply prisma migrations (interactive dev)
npx prisma migrate dev
# Open Prisma Studio
npx prisma studio
# Generate Prisma client (without running migrations)
npx prisma generate
# Import chart of accounts CSV
node scripts/import-accounts.js
```

### 7.4 Adding a New Migration

1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name meaningful_change`
3. Commit both the schema and generated migration folder

### 7.5 Coding Conventions

- Keep business logic in server actions or dedicated helpers (avoid duplicating in routes & UI)
- Centralize normalization / validation (extend `lib/validation/*`)
-- Use descriptive `TransactionKind` additions for new posting patterns

## 8. Auth (Temporary Simplification)

<!-- Duplicate heading fixed above -->
Currently: localStorage user object + custom DOM events (`user:login`, `user:logout`) to trigger UI refresh. No persistence server-side yet. Replaceable later by proper session / token system.

## 9. Roadmap (Next Phases)

| Phase | Focus | Key Items |
|-------|-------|-----------|
| Suppliers & Purchases | Mirror sales for supplier invoices | Supplier model, payable accounts (401*), VAT deductible, purchase invoice postings (initial PDF done) |
| Partial Payments | Support partial settlement | Outstanding balance logic, status PARTIAL |
| Credit Notes | Negative invoices / adjustments | Reverse postings, link to original invoice |
| Multi VAT Rates | Multiple VAT lines per invoice | Extend line model with rate, aggregate postings |
| FEC / Export | Compliance exports | Generate FEC-like file (France) from Transactions |
| Testing | Automated coverage | Unit tests for posting logic & validation |
| Auth Hardening | Real authentication | Replace local storage shim (e.g. NextAuth or custom JWT) |

## 10. Contribution Guidelines

- Keep README & `docs/accounting.md` updated when adding posting logic
- Prefer small, focused migrations
- Ensure Δ ΣDebit = ΣCredit per transactional operation (add assertion if needed)
- Document any new `TransactionKind`

## 11. Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Email duplicate error | Normalized email collision | Check existing client, adjust casing won't help |
| Missing receivable account | Import skipped or creation race | Re-create via POST client (will auto-create) |
| Prisma client stale | Schema changed without generate | Run `npx prisma generate` |
| Need to remove legacy invoices | Old numbering format INV-YYYY-#### unbalanced | Run legacy purge script (see Maintenance) |

## 12. Additional Resources

- [docs/accounting.md](./docs/accounting.md) – deep-dive rules & examples
- [Prisma Docs](https://www.prisma.io/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [CHANGELOG.md](./CHANGELOG.md) – releases and version history

---
Maintainers: update the Roadmap section as features graduate to production.

## 13. Continuous Integration & Regression Tests

This repo ships with a GitHub Actions workflow (`.github/workflows/ci.yml`) that performs:

1. Checkout & dependency install (`npm ci`)
2. PostgreSQL service bootstrap (port 5432) + migrations (`prisma migrate deploy`)
3. Chart of accounts import (`node scripts/import-accounts.js`)
4. Production build (`npm run build`) then server start (`npm start`)
5. Extended regression script: `npm run test:regression`
6. Artifact collection (`regression-rerun.log`) even on failure

### 13.1 Regression Script Scope

The script `scripts/regression-line-links.js` validates:

- 1:1 linking between invoice lines and SALE/PURCHASE transactions (foreign keys non-null)
- No line foreign key on global postings (RECEIVABLE, PAYABLE, VAT_* , PAYMENT)
- Double-entry balance (Σ Debit = Σ Credit) for sales & purchase invoices (create + patch)
- Intentional failure probe ensures assertion path is exercised

### 13.2 Running Locally

Terminal 1:

```bash
npm run dev
```

Terminal 2 (after server ready):

```bash
npm run test:regression
```

Optional: set another base URL:

```bash
BASE_URL=http://localhost:4000 npm run test:regression
```

### 13.3 CI Badge

Replace `OWNER/REPO` in the badge URL at top of this README with your real GitHub slug.

Example:

```text
https://github.com/acme-org/first-compta/actions/workflows/ci.yml/badge.svg
```

### 13.4 Troubleshooting CI

| Symptom | Cause | Fix |
|---------|-------|-----|
| Fails at migrations | DB not reachable yet | Increase healthcheck retries or add sleep |
| Regression imbalance | Missing 411/401 accounts | Ensure `import-accounts.js` ran successfully |
| fetch failed at start | Server not ready | Adjust wait loop or raise retry count in script |

### 13.5 Future Enhancements

- JUnit export for CI test reporting
- Jest/Vitest migration for granular test cases
- Matrix build (Node 18/20) & lint stage
- Data cleanup step for test artifacts

---
Documentation badge section added in this commit.

Happy hacking!

## 14. Maintenance Utilities

### 14.1 Purging Legacy Invoices (Formats)

Supported legacy patterns:

- Hyphen pattern: `INV-YYYY-####` (e.g. `INV-2024-0007`)
- Compact pattern: `INV-########` (8–15 digits, e.g. `INV-202409150123`, extended to cover longer sequences)

Select with `--mode=hyphen|compact|all` (default: hyphen). If `--mode=compact`, `--year` is ignored.

Dry-run example (all hyphen pattern 2024 limited to 10):

```bash
npm run purge:legacy -- --year=2024 --limit=10
```

Flags:

| Flag | Description |
|------|-------------|
| `--execute` | Actually delete (omit = dry-run) |
| `--mode=hyphen\|compact\|all` | Choose legacy pattern(s) |
| `--year=YYYY` | Restrict by year (hyphen/all only) |
| `--limit=N` | Limit number of invoices processed |
| `--verbose` | Print each transaction line |
| `--export=report.json` | Write JSON report (always safe) |
| `--force` | Skip interactive confirmation when executing |
| `--debug` | Output sample classification of existing invoice numbers |
| `--pattern=REGEX` | Custom regex filter applied before built-in modes |
| `--prefix=STR` | Additional prefix constraint (runs with mode logic) |
| `--numbers=inv1,inv2,...` | Explicit comma-separated list of invoice numbers to target (overrides all other filters) |

Example full execution (dangerous – irreversible) with JSON report then force delete:
npm run purge:legacy -- --mode=compact --export=legacy-final.json --execute --force --debug --prefix=INV- --pattern="^INV-\\d{10,16}$"

Notes:

1. If both --pattern and --mode are provided, a number must satisfy the custom pattern AND the selected mode logic.
2. Use --debug when zero matches occur to see a sample of existing INV-* numbers.
3. If --numbers is provided, it short-circuits pattern/prefix/mode logic: ONLY the exact listed invoice numbers are considered (still subject to --limit if specified).

```bash
npm run purge:legacy -- --mode=compact --export=legacy-report.json --execute --force
```

Targeted purge examples (explicit list):

```bash
# Dry-run of two specific invoices
node scripts/purge-legacy-invoices.js --numbers=INV-1758466471848,INV-1758467081113 --export=target-dryrun.json

# Actual deletion of the same two invoices (NO prompt)
node scripts/purge-legacy-invoices.js --numbers=INV-1758466471848,INV-1758467081113 --execute --force --export=target-final.json
```

Output shows: per-invoice debit/credit sums, global totals, net impact.

Safety recommendations:

1. Always start with a dry-run (no `--execute`).
2. Take a DB backup (pg_dump) before final purge.
3. Re-run regression script after purge.

### 14.2 PDF Generation (Unified & Paginated)

Client and supplier (incoming) invoices share a single server-side PDF generation pipeline powered by `pdf-lib` and common helpers in `src/lib/pdf/utils.js`.

Endpoints:

- Client invoices: `GET /api/invoice/:id/pdf`
- Incoming supplier invoices: `GET /api/incoming-invoices/:id/pdf`

Removed legacy (client-side) components:

- `src/components/InvoicePDF.jsx`
- `src/components/DownloadInvoicePDFButton.jsx`

Implemented enhancements:

1. Multi-page line table pagination (automatic page breaks with repeated table header)
2. Per-page header & footer (document title / continuation marker + page X / Y + legal note placeholder)
3. Shared drawing utilities (logo embedding, FR date formatting, table rendering, recap block)
4. Consistent layout between client and supplier invoices (single source of truth)
5. Smoke test script verifies generated PDF signature (`%PDF-` prefix) to catch regressions early
6. Remote Google font dependencies removed (build no longer blocked by network access)

Local font strategy:

- Current: system font fallback (no external fetch) for maximum reliability
- Planned: bundle specific corporate fonts via `next/font/local` (drop files into `public/fonts/` and expose through layout)

Smoke testing PDF generation:

```bash
node scripts/smoke-pdf.js --id=<invoiceId>
# For incoming (supplier) invoice PDF
node scripts/smoke-pdf.js --id=<invoiceId> --type=incoming
```

Script behavior:

- Fetches the appropriate PDF route
- Asserts the response is a valid PDF (magic header) and displays size in bytes
- Exits non-zero if fetch fails or content is not a PDF

Upcoming / next improvements:

- Company identity block (address, SIRET, VAT number) + configurable legal footer
- Local embedded font subset (for consistent metrics across platforms)
- Optional watermark / draft badge for non-issued invoices
- Text wrapping & cell height expansion for very long line descriptions
- More granular PDF regression tests (parse text / metadata)

#### Bloc Identité Société & Watermark

Ajouts récents:

- Bloc identité (Nom, Adresse multi-ligne, SIRET, TVA) injecté sur chaque page (`drawCompanyIdentity`).
- Watermark diagonale "BROUILLON" rendu pour les factures dont le statut = DRAFT (fonction `drawDraftWatermark`).
- Variables d'environnement supportées:
  - `COMPANY_NAME`
  - `COMPANY_ADDRESS` (peut contenir des retours à la ligne `\n`)
  - `COMPANY_SIRET`
  - `COMPANY_VAT`

Sans variables définies, des valeurs de secours (placeholders) sont utilisées.

#### Script de test PDF

#### Police embarquée & Multi-taux TVA

Améliorations récentes:

- Chargement optionnel d'une police locale TTF (`PDF_FONT_PATH` ou fallback `public/fonts/Inter-Regular.ttf`).
- Calcul dynamique multi-taux: chaque ligne peut porter `vatRate`; sinon le taux global de la facture est utilisé.
- Récap multi-taux affiche pour chaque %: Base + TVA puis totaux HT / TVA / TTC.

Variables / ENV:

| Variable | Rôle |
|----------|------|
| `PDF_FONT_PATH` | Chemin absolu/relatif vers une police TTF à embarquer |
| `COMPANY_*` | Identité société (voir plus haut) |

Script test enrichi:

```bash
npm run test:pdf -- --id=<id> --expect-multi-vat
```

Ce flag vérifie la présence des motifs `Base (XX%)` et `TVA  (XX%)`.

Limitations actuelles:

- Pas encore de wrapping multi-lignes sur description longue pour conserver alignements dans tableau.
- La detection texte dépend de l'encodage simple (latin1), ce qui peut échouer avec certaines polices ou sous-ensembles.

Commande:

```bash
npm run test:pdf -- --id=<invoiceId>
npm run test:pdf -- --id=<incomingInvoiceId> --type=incoming
npm run test:pdf -- --id=<invoiceId> --expect-draft
```

 Ce script :

1. Télécharge le PDF (client ou fournisseur) depuis le serveur local (`BASE_URL` modifiable).
2. Vérifie l'en-tête `%PDF-`.
3. Tente de détecter le SIRET ou le mot-clef `SIRET` (selon encodage texte).
4. Vérifie la présence du watermark si `--expect-draft`.
5. Sauvegarde le PDF sous `./scripts/../tmp/pdf-test-*.pdf` pour inspection.

Limitations : extraction texte naïve (encodage PDF peut masquer certains glyphes). Pour tests plus robustes, intégrer un parseur dédié ultérieurement.

### 14.3 Polices Locales (Intégration)

Objectif: Éviter toute dépendance réseau (Google Fonts) et garantir des métriques cohérentes (layout stable, build CI sans échecs offline).

Deux approches supportées:

1. `@font-face` manuel dans `globals.css`
2. `next/font/local` (recommandé: gestion automatique des préloads + hash de cache)

Étapes (approche next/font/local) :

1. Déposer les fichiers `.woff2` dans `public/fonts/` (ex: `Inter-Regular.woff2`, `Inter-SemiBold.woff2`).
2. Décommenter le bloc `localFont` dans `src/app/layout.js` et ajuster la liste `src` (poids / styles nécessaires).
3. Ajouter la classe ou variable CSS générée (ex: `inter.variable`) sur la balise `<body>` ou via Tailwind (si intégré).
4. Supprimer toute référence à des CDN externes de polices (déjà effectué).
5. (Optionnel) Générer des sous-ensembles (subsetting) pour réduire le poids: latin, latin-ext.

Sous-ensemble (exemple indicatif utilisant glyphhanger):

```bash
npx glyphhanger --subset=./public/fonts/Inter-Regular.ttf --US-ASCII --formats=woff2
```

Approche `@font-face` directe (exemple à placer dans `globals.css`):

```css
@font-face {
  font-family: "Inter";
  src: url("/fonts/Inter-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Inter";
  src: url("/fonts/Inter-SemiBold.woff2") format("woff2");
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}
body { font-family: var(--font-sans, "Inter", system-ui, Arial, sans-serif); }
```

Bonnes pratiques:

- Toujours privilégier WOFF2 (taille / perf). Ajouter WOFF seulement si vieux navigateurs cibles.
- Conserver un fallback system-ui.
- Limiter le nombre de variantes (poids) réellement utilisées pour ne pas gonfler le bundle.
- Vérifier le CLS (Cumulative Layout Shift) après introduction des polices.

Évolutions futures possibles:

- Intégration d'une police variable unique (`Inter-Variable.woff2`) avec axe wght.
- Embedding direct dans les PDFs (actuellement PDF utilise une police standard; extension future: registerFont + subset dynamique).
- Script d'automatisation de subsetting (fonttools) dans `scripts/`.

## 15. Navigation & Navbar Refactor (Legacy Path Deprecation)

Récente refactorisation de la barre de navigation et de la navigation interne des sections :

1. Regroupement des composants de navigation principale dans `src/components/navbar/` :

  - `Navbar.jsx` (composant principal)
  - `NavbarDropdown.jsx` (menus déroulants: Dashboard, Analyse, Trésorerie, Tiers)
  - `index.js` (barrel export optionnel)

1. Regroupement de la navigation interne de page d'accueil (scroll spy) dans `src/components/homeSection/` :

  - `HomeSectionNav.jsx`
  - `HomeSectionNavSkeleton.jsx`

1. Suppression de l'ancien fichier legacy `src/components/NavbarDropdown.jsx` (à la racine du dossier `components/`). Un stub temporaire avait provoqué des erreurs de type React (duplicate default export / element type invalid) et a été définitivement retiré.

1. Import racine mis à jour dans `src/app/layout.js` pour pointer directement sur `@/components/navbar/Navbar` afin d'éviter toute résolution ambiguë lors du hot reload.

### 15.1 Import Correct (Exemples)

Préféré (explicite) :

```js
import Navbar from '@/components/navbar/Navbar';
// ou pour utiliser aussi le dropdown directement (rare)
import { NavbarDropdown } from '@/components/navbar';
```

Éviter / Interdit :

```js
import NavbarDropdown from '@/components/NavbarDropdown'; // (legacy – supprimé)
```

### 15.2 Règle ESLint de Protection

Une règle `no-restricted-imports` empêche toute réintroduction du chemin legacy (`@/components/NavbarDropdown` ou variantes). Si quelqu'un recrée le fichier supprimé, une règle dédiée déclenchera une erreur immédiate pour empêcher sa réutilisation accidentelle.

Raison : le fichier legacy a déjà généré des ambiguïtés de résolution (HMR) et des collisions d'exportations lors de la transition. Centraliser les composants dans `navbar/` simplifie la maintenance et évite les chemins fantômes.

### 15.3 Bonnes Pratiques Post-Refactor

- Toujours ajouter les nouveaux éléments de navigation (boutons, badges, menus) dans `NavbarDropdown.jsx` ou dans un sous-composant local importé par celui‑ci.
- Éviter de dupliquer la logique d'état utilisateur / événements `user:login` & `user:logout` en dehors de `Navbar.jsx`.
- Pour des ancres internes avec surlignage de section (scroll spy), étendre `HomeSectionNav.jsx` au lieu de réinventer un observer ailleurs.
- Si vous réactivez l'import via barrel (`@/components/navbar`), vérifier que votre IDE n'insère pas par erreur un chemin legacy mis en cache.

### 15.4 Migration Résumée

| Avant | Après |
|-------|-------|
| `src/components/NavbarDropdown.jsx` | `src/components/navbar/NavbarDropdown.jsx` |
| `import NavbarDropdown from '@/components/NavbarDropdown'` | `import { NavbarDropdown } from '@/components/navbar'` ou import direct ciblé |

Aucune autre modification fonctionnelle n'a été introduite lors de cette étape; il s'agit d'une réorganisation préventive pour stabilité et évolutivité.

### 15.5 Dépannage

| Symptôme | Cause probable | Action |
|----------|----------------|--------|
| Erreur ESLint: chemin legacy interdit | Import vers ancien fichier | Corriger import selon exemples §15.1 |
| React: "Element type is invalid" après création manuelle du vieux fichier | Fichier legacy recréé, conflit d'exports / version incohérente | Supprimer le fichier recréé; respecter structure `navbar/` |
| Scroll spy ne met plus à jour l'état | IntersectionObserver débranché suite refactor externe | Vérifier hooks dans `HomeSectionNav.jsx` et IDs de sections |

---
Cette section documente officiellement la dépréciation du chemin legacy afin de prévenir les régressions futures.

Note: The sidebar used by the app is `src/components/sidebar/AuthSidebar.jsx` (canonical). The old `src/components/sidebar/Sidebar.jsx` has been removed to avoid duplication.

## 16. Payroll (Beta)

- Enable: set `ENABLE_PAYROLL=1` (default enabled when unset). Set `ENABLE_PAYROLL=0` to hide the module.
- Menu: entries live in `AuthSidebar.jsx` under the “Paie” group (feature-flagged).
- Pages:
  - `GET /payroll/periods` — periods list
  - `GET /payroll/periods/[ref]` — period detail with payslips
  - `GET /payroll/employees` — payroll employees list
  - `GET /payroll/payslips/[id]` — payslip detail
  - `GET /payroll/run` — generation wizard (draft)
- PDF: `GET /api/payroll/payslips/[id]/pdf` (placeholder; integrates with unified PDF pipeline later).
- UI: all payroll pages include a `BackButton` header for consistent navigation.


## 17. AI Assistant (Claude Sonnet)

Minimal endpoint integration for contextual assistance, drafting, or explanation using Claude Sonnet 3.5.

Endpoint:

`POST /api/ai/complete` with body `{ "prompt": "Your question" }` (streaming SSE by default).

To disable streaming and receive a single JSON response, pass `{ "prompt": "...", "stream": false }`.

Response:

```json
{ "ok": true, "text": "..." }
```

Streaming Server-Sent Events sample:

```text
data: {"type":"text","chunk":"First fragment..."}
data: {"type":"text","chunk":"Continuation..."}
event: end
data: {}
```

Configuration:

- Add `ANTHROPIC_API_KEY=sk-...` to `.env.local` (never commit the key).
- Dependency `@anthropic-ai/sdk` is declared in `package.json`.

Internal helper `src/lib/ai/anthropicClient.js` exposes `simplePrompt(prompt)` returning `{ raw, text }`.

Best Practices:

- Keep prompts concise (lower cost, faster latency).
- Use `stream: false` only for short prompts where blocking is acceptable.
- Add a future middleware for rate-limiting & auth gating.
- Avoid sending sensitive identifiers: hash / mask if necessary.
- Consider caching deterministic prompts (LRU) to reduce spend.

Future Enhancements:

- Structured tool outputs (JSON schemas) for reconciliations.
- Streaming responses for long reasoning chains.
- Multi‑model fallback (retry on transient errors).

Example (PowerShell):

```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/ai/complete -Method POST -Body '{"prompt":"Explain the difference between debit and credit"}' -ContentType 'application/json'
```

## Coverage

Placeholder badge at top will be replaced once test coverage instrumentation (e.g. Vitest or Jest + Istanbul) is introduced. Planned steps:

1. Introduce test runner (Vitest) with `--coverage` producing `lcov.info`.
1. Upload artifact in CI and optionally send to Codecov / coveralls.
1. Replace static shield with dynamic badge (Codecov) or Shields endpoint.

Until then, the static badge communicates the feature is pending.

## 18. Payroll Configuration (Contribution Schemes, Tax Rules, Cost Centers)

New beta endpoints add structured payroll configuration used during payslip calculations (social contributions, progressive tax brackets, costing allocations). All routes are feature-flagged by `ENABLE_PAYROLL`.

| Resource | Collection | Item |
|----------|-----------|------|
| Contribution Scheme | `GET /api/payroll/contribution-schemes` / `POST /api/payroll/contribution-schemes` | `GET /api/payroll/contribution-schemes/:id`, `PUT /api/payroll/contribution-schemes/:id`, `DELETE /api/payroll/contribution-schemes/:id` |
| Tax Rule | `GET /api/payroll/tax-rules` / `POST /api/payroll/tax-rules` | `GET /api/payroll/tax-rules/:id`, `PUT /api/payroll/tax-rules/:id`, `DELETE /api/payroll/tax-rules/:id` |
| Cost Center | `GET /api/payroll/cost-centers` / `POST /api/payroll/cost-centers` | `GET /api/payroll/cost-centers/:id`, `PUT /api/payroll/cost-centers/:id`, `DELETE /api/payroll/cost-centers/:id` |

### 18.1 Contribution Scheme Shape

```json
{
  "code": "CS01",
  "label": "Retirement Base",
  "employeeRate": 0.07,
  "employerRate": 0.10,
  "ceiling": 3500.00,
  "baseKind": "BRUT", // BASE_SALAIRE | BRUT | IMPOSABLE
  "active": true
}
```

Notes:

- Rates are decimals (fractional, not percentages) — e.g. 7% = `0.07`.
- If `ceiling` provided, contribution base is `min(grossBase, ceiling)`.
- `baseKind` indicates which computed base the scheme applies to.

### 18.2 Tax Rule Shape & Brackets

`brackets` is a JSON array of ascending threshold objects:

```json
{
  "code": "TAX-PROG",
  "label": "Progressive Income",
  "brackets": [
    { "upTo": 1000, "rate": 0.00 },
    { "upTo": 2500, "rate": 0.10 },
    { "upTo": 6000, "rate": 0.20 },
    { "upTo": 999999999, "rate": 0.30 }
  ],
  "roundingMode": "BANKERS", // NONE | BANKERS | UP | DOWN
  "active": true
}
```

Validation rules:

- Must be an array; each entry requires numeric `upTo` (inclusive cap) and numeric `rate` (fraction).
- Array should be strictly ascending by `upTo` (enforced server-side; client pre-validation added in UI).
- Highest bracket typically uses a large sentinel upper bound.
- Rounding applied to final tax result, not per bracket subtotal.

### 18.3 Cost Center Shape

```json
{
  "code": "CC-SALES",
  "label": "Commercial Team",
  "active": true
}
```

Deletion Safety:

- A cost center cannot be deleted if referenced by payroll allocations or transactions (endpoint returns `409 Conflict`).

### 18.4 Common API Behaviors

| Aspect | Behavior |
|--------|----------|
| Feature Flag | Returns 403 if payroll disabled. |
| Errors | 400 validation, 404 not found, 409 conflict (cost center), 500 unexpected errors. |
| Rates / Decimals | Send JSON numbers; avoid strings. |
| Partial Update | `PUT` endpoints apply only provided fields. |

### 18.5 Example Create (PowerShell)

```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/payroll/contribution-schemes -Method POST -Body '{"code":"CS01","label":"Retirement","employeeRate":0.07,"employerRate":0.10,"ceiling":3500,"baseKind":"BRUT"}' -ContentType 'application/json'
```

### 18.6 Frontend UI

Page: `/payroll/config` — inline tables & forms for all three resources with client-side JSON bracket validation + toast feedback. Editing is row‑inline; deletion prompts confirmation.

### 18.7 Future Enhancements

- Bracket ordering + continuity assertion (start at 0).
- Effective dates / versioning.
- Allocation reporting by cost center (per period).
- Rate limiting & auth guard.

### 18.8 Validation Rules

Server-side validation consolidates all checks and returns a uniform error payload:

```jsonc
{ "ok": false, "error": "validation", "details": ["employeeRate.range", "brackets.2.order"] }
```

If a uniqueness conflict occurs on `code`, endpoints return:

```jsonc
{ "ok": false, "error": "code.exists" }
```

Cost center deletion when referenced returns HTTP 409 with a descriptive message (not a structured code):

```jsonc
{ "ok": false, "error": "Cost center referenced; deactivate instead." }
```

#### 18.8.1 Contribution Scheme Error Codes

| Code | Meaning |
|------|---------|
| `code.required` | `code` missing |
| `code.format` | Invalid format (`^[A-Z0-9][A-Z0-9_-]{0,31}$`) |
| `label.required` | `label` missing |
| `label.length` | `label` exceeds 120 chars |
| `employeeRate.nan` | `employeeRate` not a number |
| `employeeRate.range` | `employeeRate` outside [0,1] |
| `employerRate.nan` | `employerRate` not a number |
| `employerRate.range` | `employerRate` outside [0,1] |
| `ceiling.invalid` | `ceiling` provided but ≤ 0 or NaN |
| `baseKind.invalid` | Not one of `BASE_SALAIRE`, `BRUT`, `IMPOSABLE` |
| `code.exists` | Duplicate `code` (409) |

#### 18.8.2 Tax Rule Error Codes

| Code | Meaning |
|------|---------|
| `code.required` | Missing `code` |
| `code.format` | Fails regex `^[A-Z0-9][A-Z0-9_-]{0,31}$` |
| `label.required` | Missing `label` |
| `label.length` | `label` exceeds 160 chars |
| `roundingMode.invalid` | Not one of `NONE`, `BANKERS`, `UP`, `DOWN` |
| `brackets.json` | String `brackets` fails JSON parse |
| `brackets.array` | Parsed `brackets` not an array |
| `brackets.{i}.object` | Entry not an object |
| `brackets.{i}.upTo` | `upTo` missing / ≤ 0 / NaN |
| `brackets.{i}.rate` | `rate` missing / NaN / outside [0,1] |
| `brackets.{i}.order` | `upTo` not strictly ascending vs previous |
| `brackets.first.upToPositive` | First bracket `upTo` ≤ 0 |
| `code.exists` | Duplicate `code` (409) |

#### 18.8.3 Cost Center Error Codes

| Code | Meaning |
|------|---------|
| `code.required` | Missing `code` |
| `code.format` | Invalid format regex |
| `label.required` | Missing `label` |
| `label.length` | `label` exceeds 120 chars |
| `code.exists` | Duplicate `code` (409) |

#### 18.8.4 Validation Field Semantics

- `code.format` regex: leading uppercase alphanumeric, then up to 31 chars of uppercase alphanumeric, `_` or `-`. Total max length 32.
- Rates (`employeeRate`, `employerRate`, bracket `rate`): fractional decimals in [0,1] (e.g. 7% = 0.07).
- Brackets must be strictly ascending by `upTo`; a large sentinel (e.g. `999999999`) may cap the top bracket.
- Continuity check currently enforces first bracket positive (`>0`); future enhancement will assert start coverage from 0.
- Ceiling (`contributionScheme.ceiling`): optional; must be > 0 when present; `null` or omitted = no cap.
- Rounding applies to the final aggregated tax result (not per bracket) according to `roundingMode`.

#### 18.8.5 Examples

Invalid contribution scheme (bad code + rate):

```json
{
  "ok": false,
  "error": "validation",
  "details": ["code.format", "employeeRate.range"]
}
```

Invalid tax rule (descending bracket + invalid rounding mode):

```json
{
  "ok": false,
  "error": "validation",
  "details": ["roundingMode.invalid", "brackets.2.order"]
}
```

Duplicate code (any entity):

```json
{ "ok": false, "error": "code.exists" }
```


