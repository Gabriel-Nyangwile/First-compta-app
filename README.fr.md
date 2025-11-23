# First Compta

[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-pending-lightgrey)](#couverture)
[![Dernière version](https://img.shields.io/github/v/release/Gabriel-Nyangwile/first-compta?display_name=tag&sort=semver&label=version)](https://github.com/Gabriel-Nyangwile/first-compta/releases)

> Version française – Pour la version originale en anglais, voir `README.md`.

Noyau de comptabilité en partie double léger (factures, écritures, TVA) construit avec Next.js App Router + Prisma.

## 1. Vue d'ensemble

Ce projet implémente une couche comptable minimale mais extensible pour les factures de vente dans une stack React moderne (Next.js) :

- Écritures en partie double (créances clients, produits, TVA collectée)
- Grand livre des écritures avec sens débit/crédit et types sémantiques
- Cycle de vie de la facture : brouillon → émise → payée (via écritures de règlement)
- Export CSV & filtrage des écritures
- Gestion des clients (CRUD) avec compte client rattaché
- Autocomplétion comptes & clients (recherche + création inline)

Le périmètre actuel se concentre sur les ventes (clients). Un module fournisseurs / achats suivra (voir Feuille de route).

Les détails fonctionnels et techniques de la logique comptable sont dans : `docs/accounting.md` (non traduit pour l'instant).

## 2. Stack & Architecture

| Couche | Technologie | Notes |
|-------|-------------|-------|
| UI / Routing | Next.js (App Router, React 19) | Composants serveur + client mélangés |
| Accès aux données | Prisma (PostgreSQL) | Modèles typés & migrations |
| Auth (temporaire) | localStorage simplifié + événements DOM | Approche dev uniquement (pas de sessions / JWT) |
| PDF | Route serveur + composant React | `InvoicePDF.jsx` rendu pour téléchargement |
| Validation | Helper central (`lib/validation/client.js`) | Normalisation & enums contrôlés |

### 2.1 Frontend

Les pages résident sous `src/app/` suivant les conventions App Router. Les composants réutilisables sont dans `src/components/`.

Écrans clés :

- `/invoices` liste & création
- `/invoices/[id]` détail (avec téléchargement PDF)
- `/clients` liste, création, édition
- `/transactions` grand livre & export CSV

### 2.2 Backend (Routes API)

Les endpoints API sont co-localisés sous `src/app/api/*`. Chaque ressource utilise des verbes REST (GET, POST, PUT, DELETE) par dossier de route.

### 2.3 Flux de Données (Création Facture)

1. L'utilisateur soumet le formulaire (lignes référencent des numéros de comptes)
1. L'API valide + écrit `Invoice` & `InvoiceLine`
1. Génération des écritures :

- Débit compte client (411*)
- Crédit compte de produits (agrégation des lignes)
- Crédit TVA collectée (4457*) si applicable

1. La réponse renvoie la facture persistée avec son numéro.

### 2.4 Flux de Règlement

Le paiement déclenche l'endpoint de règlement → écritures :

- Débit banque / caisse (512 / 53… prévu; placeholder actuel)
- Crédit créance client

La facture passe à PAID quand le solde atteint zéro.

## 3. Modèle de Données (Résumé Prisma)

Modèles principaux (abrégé — voir `prisma/schema.prisma` pour la source) :

- `Client` : identité + catégorie + compte client rattaché
- `Account` : plan comptable générique (numéro, nom, relations optionnelles)
- `Invoice` : en-tête (client, statut, issueDate, montants)
- `InvoiceLine` : référence comptes produits / TVA et bases
- `Transaction` : écriture avec `direction` (DEBIT|CREDIT) & `kind` (enum sémantique)

Enums importants :

- `TransactionDirection` : DEBIT / CREDIT
- `TransactionKind` : INVOICE_RECEIVABLE, INVOICE_SALES, INVOICE_VAT_COLLECTED, PAYMENT_RECEIVABLE_CLEARING (susceptible d'évoluer)
- `ClientCategory` : catégorisation pour logique d'échéance

## 4. Flux Comptables (Ventes)

Voir `docs/accounting.md` pour le détail. Récapitulatif :

| Scénario | Écritures | Notes |
|----------|-----------|-------|
| Émission facture | DR Créance / CR Produits / CR TVA | Produits agrégés par comptes de revenus |
| Règlement (total) | DR Banque / CR Créance | Marque la facture PAYÉE |
| Règlement partiel (futur) | DR Banque / CR Créance (partiel) | Statut PARTIAL géré par la logique |

Invariant partie double : Σ Débits = Σ Crédits par groupe opérationnel.

## 5. Validation & Helpers

Centralisé dans `lib/validation/client.js` :

- `normalizeEmail(email)` → minuscule + trim
- `validateCategory(category)` → vérifie appartenance à `VALID_CLIENT_CATEGORIES`
- `getPaymentDays(category)` → map catégorie → délai par défaut

Appliqué dans `POST /api/clients` et `PUT /api/clients/[id]`.

## 6. API (Actuel)

Chemin de base : `/api`

| Endpoint | Méthode(s) | Objet |
|----------|------------|-------|
| `/accounts/search` | GET | Autocomplétion comptes par préfixe |
| `/account/create` | POST | Créer un compte |
| `/clients` | GET, POST | Lister ou créer clients |
| `/clients/search` | GET | Recherche nom (autocomplete) |
| `/clients/[id]` | GET, PUT, DELETE | Récupérer / modifier / supprimer un client (cleanup compte orphelin) |
| `/invoices` | GET, POST | Lister ou créer factures |
| `/invoices/next-number` | GET | Prochain numéro séquentiel |
| `/invoice/[id]/pdf` | GET | Générer PDF pour une facture |
| `/transactions` | GET | Grand livre filtré + agrégats + CSV |

Exemple : création client

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
 
Renvoie 201 avec JSON (email normalisé, compte client créé si besoin).

Erreurs possibles :

- 400 catégorie invalide
- 409 email déjà existant (comparaison normalisée)

## 7. Workflow de Développement

### 7.1 Prérequis

- Node.js 18+
- Instance PostgreSQL

### 7.2 Installation

```bash
npm install
npx prisma migrate dev
node scripts/import-accounts.js   # import plan comptable
npm run dev
```

Visiter <http://localhost:3000>

### 7.3 Commandes Utiles

```bash
npm run dev                # serveur dev
npx prisma migrate dev     # migrations interactives
tx prisma studio           # (corriger si script ajouté)
npx prisma generate        # génération client Prisma
node scripts/import-accounts.js
```

### 7.4 Nouvelle Migration

1. Modifier `prisma/schema.prisma`
2. `npx prisma migrate dev --name nom_significatif`
3. Commit du schema + dossier migration

### 7.5 Conventions Code

- Logique métier dans actions serveur / helpers dédiés
- Normalisation / validation centralisées (`lib/validation/*`)
- Noms explicites pour nouveaux `TransactionKind`

## 8. Auth (Simplification Temporaire)

localStorage + événements DOM (`user:login`, `user:logout`). Pas encore de persistance serveur.

## 9. Feuille de Route

| Phase | Focus | Points clés |
|-------|-------|------------|
| Suppliers & Purchases | Miroir ventes factures fournisseurs | Modèle fournisseur, comptes 401*, TVA déductible |
| Partial Payments | Paiements partiels | Solde restant, statut PARTIAL |
| Credit Notes | Avoirs / ajustements | Postings inverses, lien facture d'origine |
| Multi VAT Rates | Multi taux TVA | Lignes TVA multiples & agrégation |
| FEC / Export | Exports conformité | Génération fichier type FEC |
| Testing | Couverture automatisée | Tests unités logique d'écritures |
| Auth Hardening | Auth réelle | Remplacer shim localStorage |

## 10. Lignes Directrices Contribution

- Mettre à jour README & `docs/accounting.md` quand logique d'écritures change
- Préférer migrations petites & ciblées
- Garantir Σ Débits = Σ Crédits par opération (assert possible)
- Documenter tout nouveau `TransactionKind`

## 11. Dépannage

| Problème | Cause | Correction |
|----------|-------|-----------|
| Email en doublon | Collision email normalisé | Vérifier client existant |
| Compte client manquant | Import omis ou race | Re-créer via POST client |
| Client Prisma obsolète | Schema modifié sans generate | `npx prisma generate` |

### 11.1 Erreur EMFILE: too many open files (Windows)

Pour éviter la saturation des watchers Windows (EMFILE), le projet inclut une configuration de mitigation prête à l’emploi.

- `/.vscode/settings.json` – exclusions de surveillance élargies:
  - ignore `node_modules`, `.git`, `.next`, `.turbo`, `backups`, `public`, `prisma/migrations`, `*.log`, `target-*.json`.
- `next.config.mjs` – options Webpack dev réduisant les watchers:
  - `watchOptions.ignored` avec les mêmes dossiers, `poll: 1500`, `aggregateTimeout: 300`.
  - Cache webpack dev désactivé pour éviter les locks.
- `package.json` – script `dev` basculé en mode polling (moins de descripteurs fichiers):
  - variables `CHOKIDAR_USEPOLLING=1`, `WATCHPACK_POLLING=true`, `WATCHPACK_POLL_INTERVAL=1500` via `cross-env`.

Étapes recommandées après mise à jour:

```powershell
# Fermer les Node qui pourraient verrouiller des fichiers
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

# Réinstaller si nécessaire (ajout de cross-env)
npm install

# Redémarrer le serveur dev en mode polling
npm run dev
```

Notes:

- Si vous constatez une baisse de réactivité en dev, vous pouvez revenir au watcher natif en restaurant `"dev": "next dev"` dans `package.json`.
- Les exclusions de recherche VS Code (`search.exclude`) reflètent les mêmes dossiers pour accélérer les recherches.

## 12. Ressources

- `docs/accounting.md`
- Prisma Docs
- Next.js Docs
- [CHANGELOG.md](./CHANGELOG.md) – notes de version et historique

---
Mainteneurs : mettre à jour la Feuille de route quand des fonctionnalités passent en prod.

## 13. Intégration Continue & Tests de Régression

Le workflow GitHub Actions (`.github/workflows/ci.yml`) réalise :

1. Checkout & install (`npm ci`)
2. PostgreSQL service + migrations (`prisma migrate deploy`)
3. Import plan comptable (`node scripts/import-accounts.js`)
4. Build production (`npm run build`) puis start (`npm start`)
5. Script régression étendu : `npm run test:regression`
6. Archivage log (`regression-rerun.log`) même en échec

### 13.1 Portée Script Régression

Valide :

- Lien 1:1 lignes facture ↔ transactions (vente/achat) via FKs
- Pas de FK ligne sur postings globaux (RECEIVABLE, PAYABLE, VAT_*, PAYMENT)
- Équilibre partie double (Σ Débits = Σ Crédits) création + patch
- Sonde d'échec intentionnelle pour voie assertions

### 13.2 Exécution Locale

Terminal 1 :

```bash
npm run dev
```

Terminal 2 (après readiness) :

```bash
npm run test:regression
```

Option base URL :

```bash
BASE_URL=http://localhost:4000 npm run test:regression
```

### 13.3 Badge CI

Remplacer `OWNER/REPO` dans l'URL du badge en haut.

### 13.4 Dépannage CI

| Symptôme | Cause | Correction |
|----------|-------|------------|
| Échec migrations | DB pas prête | Augmenter retries healthcheck |
| Déséquilibre régression | Comptes 411/401 manquants | Vérifier import comptes |
| fetch initial échoue | Server pas prêt | Ajuster boucle d'attente |

### 13.5 Améliorations Futures

- Export JUnit pour reporting
- Migration Jest/Vitest pour tests granulaires
- Build matrix (Node 18/20) & étape lint
- Nettoyage données tests

## Couverture

Badge placeholder (voir haut). Étapes prévues : runner tests (Vitest) + couverture Istanbul, upload artefact, badge dynamique (Codecov ou Shields endpoint).

---
Heureux de vos contributions !

## 14. Internationalisation (i18n) – Base

Une couche i18n minimale a été ajoutée pour les info‑bulles (tooltips) du module Gestion du Personnel. Elle permet de basculer FR/EN à chaud via un sélecteur.

### 14.1 Concepts

- i18n (internationalisation) : rendre l'application neutre vis‑à‑vis de la langue (utiliser des clés plutôt que du texte en dur).
- l10n (localisation) : fournir les traductions concrètes et formats régionaux.

### 14.2 Implémentation Actuelle

| Fichier | Rôle |
|---------|------|
| `src/lib/i18n.js` | Provider client + hook `useI18n()` (`t(key)`, `setLocale`) |
| `src/locales/fr.json` | Catalogue français (clés `help.*`) |
| `src/locales/en.json` | Catalogue anglais (miroir FR) |
| `src/components/LocaleSwitcher.jsx` | Bascule runtime FR / EN |
| `src/app/layout.js` | Enveloppe globale avec `I18nProvider` (locale par défaut FR) |
| `src/app/employee/page.jsx` | Utilise `t('help.xxx')` pour les `title` |

### 14.3 Exemple d'Usage

```jsx
import { useI18n } from '@/lib/i18n';
function Champ() {
  const { t } = useI18n();
  return <input title={t('help.firstName')} />;
}
```

### 14.4 Ajout d'une Nouvelle Clé

1. Choisir une clé (ex: `help.department`).
2. Ajouter la traduction FR dans `fr.json`.
3. Ajouter la traduction EN correspondante dans `en.json`.
4. Utiliser `t('help.department')` dans le code.

Fallback : si la clé manque, `t(key)` renvoie la clé elle‑même → ajouter les deux traductions pour éviter ce comportement.

### 14.5 Nouvelle Locale (ex: ES)

1. Créer `src/locales/es.json` avec la même structure.
2. Étendre `catalogs` dans `i18n.js`.
3. Ajouter le bouton ES dans `LocaleSwitcher.jsx`.

### 14.6 Bonnes Pratiques

- Clés sémantiques (`help.employeeNumber`) plutôt que liées à la présentation.
- Regrouper par domaine (ex: `invoice.*`, `auth.*`) à mesure que le périmètre grandit.
- Éviter d'injecter directement des données sensibles dans les catalogues (formatage en code si nécessaire).
- Basculer plus tard vers formatage `Intl` (dates, nombres, monnaie) si besoin multi-locale avancé.

### 14.7 Améliorations Futures

- Détection locale (profil utilisateur, `Accept-Language`).
- Routage par préfixe (`/fr`, `/en`).
- Pluriel / genre (intégration d'une lib ou helper interne).
- Messages d'erreur / validations i18n.
- Script de détection de clés orphelines.

### 14.8 Notes de Migration

Les anciens textes d'aide factorisés (`helpTexts.js`) ont été remplacés dans la page Employés. Étendre progressivement aux autres modules avant suppression totale des constantes legacy.

## 15. Paie (Bêta)

- Activation : définir `ENABLE_PAYROLL=1` (activé par défaut si non défini). Mettre `ENABLE_PAYROLL=0` pour masquer le module.
- Menu : entrées dans `AuthSidebar.jsx` sous le groupe « Paie » (protégé par le feature flag).
- Pages :
  - `GET /payroll/periods` — liste des périodes
  - `GET /payroll/periods/[ref]` — détail période + bulletins
  - `GET /payroll/employees` — liste employés (paie)
  - `GET /payroll/payslips/[id]` — détail bulletin
  - `GET /payroll/run` — assistant de génération (brouillon)
- PDF : `GET /api/payroll/payslips/[id]/pdf` (placeholder; intégration avec pipeline PDF unifié ultérieurement).
- UI : toutes les pages paie incluent un `BackButton` en en‑tête pour une navigation cohérente.

### 15.1 Configuration Paie (Schémas de Contribution, Règles Fiscales, Centres de Coût)

### 15.0 Suivi feuille de route Paie / Personnel
- Etape 1 (validation RH) : controles sur `POST/PUT /api/employee` (noms requis, bornes dates hire/end/birth, enums statut/contrat, retour 409 sur doublon email/matricule).
- Etape 2 (ventilation analytique paie) : snapshot des `EmployeeCostAllocation` vers `PayslipCostAllocation` lors de la generation/recalcul des bulletins; postings paie utilisent desormais le snapshot (fallback employe) pour ventiler charges salaires/primes.
- Etape 3 (garde-fous + PDF bulletins) : mutations presence/variables/recalcul interdites hors periode OPEN; PDF bulletins branche sur utilitaires communs (identite societe, watermark BROUILLON, tri lignes, pagination).
- Note 2025-11-23 : workflows paie/personnel committes et pousses (postings equilibrés, PDF payslip OK); prochaine etape = poursuivre la roadmap (journal paie, audits, PDF aligné).
- Audit paie : script `npm run audit:payroll:posting -- --ref=PP-000123` ou `--all` (vérifie équilibre journal vs bulletins pour chaque période POSTED).

Endpoints (feature flag `ENABLE_PAYROLL`) :

| Ressource | Collection | Item |
|-----------|------------|------|
| Schéma de contribution | `GET /api/payroll/contribution-schemes` / `POST /api/payroll/contribution-schemes` | `GET /api/payroll/contribution-schemes/:id`, `PUT /api/payroll/contribution-schemes/:id`, `DELETE /api/payroll/contribution-schemes/:id` |
| Règle fiscale | `GET /api/payroll/tax-rules` / `POST /api/payroll/tax-rules` | `GET /api/payroll/tax-rules/:id`, `PUT /api/payroll/tax-rules/:id`, `DELETE /api/payroll/tax-rules/:id` |
| Centre de coût | `GET /api/payroll/cost-centers` / `POST /api/payroll/cost-centers` | `GET /api/payroll/cost-centers/:id`, `PUT /api/payroll/cost-centers/:id`, `DELETE /api/payroll/cost-centers/:id` |

#### 15.1.1 Schéma de Contribution (exemple)

```json
{
  "code": "CS01",
  "label": "Retraite Base",
  "employeeRate": 0.07,
  "employerRate": 0.10,
  "ceiling": 3500.00,
  "baseKind": "BRUT",
  "active": true
}
```

Notes :

- Taux en décimaux (0.07 = 7%).
- `ceiling` null si pas de plafond.
- `baseKind` détermine la base utilisée (BASE_SALAIRE | BRUT | IMPOSABLE).

#### 15.1.2 Règle Fiscale (brackets)

```json
{
  "code": "TAX-PROG",
  "label": "Impôt Progressif",
  "brackets": [
    { "upTo": 1000, "rate": 0.00 },
    { "upTo": 2500, "rate": 0.10 },
    { "upTo": 6000, "rate": 0.20 },
    { "upTo": 999999999, "rate": 0.30 }
  ],
  "roundingMode": "BANKERS",
  "active": true
}
```

Règles de validation :

- Tableau obligatoire, chaque entrée avec `upTo` numérique et `rate` numérique.
- Ordre strictement croissant sur `upTo`.
- Dernière entrée peut utiliser un grand plafond sentinelle.
- Arrondi appliqué sur le total final, pas par tranche.

#### 15.1.3 Centre de Coût

```json
{ "code": "CC-SALES", "label": "Équipe Commerciale", "active": true }
```

Suppression : retourne `409 Conflict` si encore référencé (allocations / transactions paie).

#### 15.1.4 Comportements Communs

| Aspect | Comportement |
|--------|--------------|
| Feature Flag | 403 si module paie désactivé |
| Erreurs | 400 validation, 404 non trouvé, 409 conflit (centre de coût), 500 interne |
| Décimaux | Envoyer des nombres JSON (pas de chaînes) |
| PUT partiel | Seuls les champs fournis sont mis à jour |

#### 15.1.5 Création Exemple (PowerShell)

```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/payroll/contribution-schemes -Method POST -Body '{"code":"CS01","label":"Retraite","employeeRate":0.07,"employerRate":0.10,"ceiling":3500,"baseKind":"BRUT"}' -ContentType 'application/json'
```

#### 15.1.6 UI

Page : `/payroll/config` – formulaires inline + tableaux, validation JSON client pour les brackets, toasts feedback.

#### 15.1.7 Extensions Futures

- Vérification continuité des tranches (démarrage à 0).
- Dates d'effet / versionnement.
- Rapport d'allocation par centre de coût.
- Rate limiting & garde auth.

#### 15.1.8 Règles de Validation

Toutes les validations serveur renvoient un format unifié :

```jsonc
{ "ok": false, "error": "validation", "details": ["employeeRate.range", "brackets.2.order"] }
```

Conflit d'unicité sur `code` :

```jsonc
{ "ok": false, "error": "code.exists" }
```

Suppression centre de coût référencé (409) :

```jsonc
{ "ok": false, "error": "Cost center referenced; deactivate instead." }
```

Les codes d'erreur (`details`) sont composés de segments séparés par des points. Pour les tableaux `brackets`, `{i}` représente l'index (0‑based).

##### Schéma de Contribution – Codes

| Code | Signification |
|------|---------------|
| `code.required` | `code` manquant |
| `code.format` | Format invalide (`^[A-Z0-9][A-Z0-9_-]{0,31}$`) |
| `label.required` | `label` manquant |
| `label.length` | Longueur > 120 caractères |
| `employeeRate.nan` | `employeeRate` n'est pas numérique |
| `employeeRate.range` | `employeeRate` hors intervalle [0,1] |
| `employerRate.nan` | `employerRate` n'est pas numérique |
| `employerRate.range` | `employerRate` hors intervalle [0,1] |
| `ceiling.invalid` | Plafond fourni mais ≤ 0 ou NaN |
| `baseKind.invalid` | Valeur hors `BASE_SALAIRE`, `BRUT`, `IMPOSABLE` |
| `code.exists` | `code` déjà utilisé (409) |

##### Règle Fiscale – Codes

| Code | Signification |
|------|---------------|
| `code.required` | `code` manquant |
| `code.format` | Format regex invalide |
| `label.required` | `label` manquant |
| `label.length` | Longueur > 160 caractères |
| `roundingMode.invalid` | Mode hors `NONE`, `BANKERS`, `UP`, `DOWN` |
| `brackets.json` | Échec parse JSON de la chaîne transmise |
| `brackets.array` | Structure non tableau |
| `brackets.{i}.object` | Entrée non objet |
| `brackets.{i}.upTo` | `upTo` manquant / ≤ 0 / NaN |
| `brackets.{i}.rate` | `rate` manquant / NaN / hors [0,1] |
| `brackets.{i}.order` | `upTo` non strictement croissant |
| `brackets.first.upToPositive` | Première tranche `upTo` ≤ 0 |
| `code.exists` | `code` déjà utilisé (409) |

##### Centre de Coût – Codes

| Code | Signification |
|------|---------------|
| `code.required` | `code` manquant |
| `code.format` | Format regex invalide |
| `label.required` | `label` manquant |
| `label.length` | Longueur > 120 caractères |
| `code.exists` | `code` déjà utilisé (409) |

##### Sémantique des Champs

- Regex `code.format` : 1er caractère alphanumérique majuscule, puis jusqu'à 31 caractères parmi majuscules, chiffres, `_` ou `-` (longueur max 32).
- Taux (`employeeRate`, `employerRate`, `rate` de tranche) exprimés en décimaux fractionnaires (7% = `0.07`) dans [0,1].
- Tranches (`brackets`) strictement ascendantes sur `upTo`; un plafond sentinelle large est autorisé pour la dernière.
- La continuité (démarrage à 0) sera ajoutée ultérieurement; actuellement seule la positivité du premier `upTo` est contrôlée.
- `ceiling` optionnel : doit être > 0 si présent; absent ou null = pas de plafond.
- L'arrondi (`roundingMode`) s'applique sur le montant total calculé, pas sur chaque sous-tranche.

##### Exemples

Schéma de contribution invalide (code + taux) :

```json
{ "ok": false, "error": "validation", "details": ["code.format", "employeeRate.range"] }
```

Règle fiscale invalide (ordre) :

```json
{ "ok": false, "error": "validation", "details": ["brackets.2.order"] }
```

Code dupliqué :

```json
{ "ok": false, "error": "code.exists" }
```


### 15.1 Script Smoke Paie (Heures Sup + Postings)

Un script de validation bout‑en‑bout existe : `scripts/smoke-payroll-overtime-post.js`.

Objectif : générer une période avec variables & heures sup, verrouiller, poster les écritures comptables puis automatiquement inverser (reversal) et déverrouiller pour revenir à l'état propre `OPEN`. Aucun résidu (journal ou statut) ne reste après exécution — idéal pour tests répétés.

Calcul heures sup :

- Variables d'environnement optionnelles : `PAYROLL_HOURS_PER_DAY` (par défaut 8), `PAYROLL_OVERTIME_MULTIPLIER` (ex: 1.5)
- Heures sup monétisées = (heures_supp × (base / heures_jour)) × multiplicateur

Exécution :

```powershell
node scripts/smoke-payroll-overtime-post.js
```

Sortie attendue (abrégé) :

- Génération bulletins (lignes BASE, PRIME pour variables positives, OT pour heures sup)
- Verrouillage période → Postings journal équilibrés (Σ Débits = Σ Crédits)
- Reversal immédiat des transactions postées
- Déverrouillage période → statut `OPEN` restauré

Notes :

- Le script est auto‑réversant (pas de flag). Pour inspection manuelle prolongée, commenter l'appel `maybeReverseAndUnlock()` dans le script localement.
- Toutes les lignes PRIME (variables, heures sup) agrègent vers le compte de charges « bonus » défini par la logique interne.

### 16. Assistant IA (Claude Sonnet)

Intégration minimale d'un endpoint IA pour assister l'utilisateur (analyse, aide contextuelle) via Claude Sonnet 3.5.

Endpoint :

`POST /api/ai/complete` `{ "prompt": "Votre question" }` (mode streaming par défaut)

Pour une réponse non-streaming (blocante), ajouter `"stream": false`.

Réponse :

```json
{ "ok": true, "text": "..." }
```

Streaming SSE (événements) :

```text
event: message
data: {"type":"text","chunk":"Premier fragment ..."}

event: message
data: {"type":"text","chunk":"Suite ..."}

event: end
data: {}
```

Configuration :

- Définir la clé: `ANTHROPIC_API_KEY=sk-...` dans `.env.local` (ne pas committer).
- Dépendance: `@anthropic-ai/sdk` ajoutée dans `package.json`.

Client interne (`src/lib/ai/anthropicClient.js`) fournit `simplePrompt(prompt)`.

Bonnes pratiques :

- Limiter la taille des prompts (compter tokens pour éviter coûts élevés).
- Utiliser `stream: false` seulement pour petits prompts où la latence n'est pas critique.
- Ajouter plus tard un cache ou un guard rate-limit.
- Ne pas envoyer de données sensibles (hash/masquage si nécessaire).


