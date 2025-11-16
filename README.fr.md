# First Compta

[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-pending-lightgrey)](#couverture)

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

## 12. Ressources

- `docs/accounting.md`
- Prisma Docs
- Next.js Docs

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

