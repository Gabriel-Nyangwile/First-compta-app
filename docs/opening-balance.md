# Guide de reprise d'ouverture des comptes

## Vue d'ensemble

Ce guide explique comment effectuer une reprise d'ouverture pour une nouvelle société dans le système comptable, ou pour une société dont l'historique antérieur n'est pas encore tenu dans l'application.

Si l'exercice complet a déjà été tenu dans l'application, utiliser plutôt la procédure de clôture annuelle et réouverture : [annual-closing.md](./annual-closing.md).

### Accès utilisateur

Dans l'application, ouvrir :

```text
Comptabilité > Ouverture d'exercice
```

L'écran permet de télécharger les modèles Excel, importer les fichiers, lancer une prévisualisation, lire le rapport d'erreurs puis valider l'import définitif.

Les commandes `npm run opening:*` restent disponibles comme procédure technique de secours.

### Ce que fait l'ouverture des comptes

- **Balance générale** : Saisie des soldes de tous les comptes comptables
- **Stock** : Valorisation de l'inventaire initial
- **Immobilisations** : Enregistrement des actifs fixes avec amortissements
- **Clients/Fournisseurs** : Création des tiers avec soldes ouverts

### Prérequis

- Société créée dans le système
- Fichiers Excel préparés selon les gabarits
- Accès aux données comptables de clôture de l'exercice précédent
- Droits d'administration pour les imports

### ⚠️ Points importants

- **Date d'ouverture** : Fixée au 01/01/2026
- **Ordre d'import** : Respecter la séquence pour éviter les conflits
- **Prévisualisation** : Tester toujours chaque fichier avant l'import réel
- **Idempotence** : Les imports sont protégés contre les duplicatas
- **Smoke E2E** : `npm run test:opening` valide le kit complet sur une société temporaire
- **Droits** : Accès réservé aux rôles `SUPERADMIN`, `FINANCE_MANAGER` et `ACCOUNTANT`

## 1. Préparation des données

### Génération des gabarits Excel

Commencez par générer les fichiers modèles :

```bash
npm run opening:templates
```

Cette commande crée 5 fichiers dans `scripts/templates/` :
- `opening-balance-template.xlsx` - Balance générale
- `opening-stock-template.xlsx` - Inventaire
- `opening-assets-template.xlsx` - Immobilisations
- `opening-ar-template.xlsx` - Clients
- `opening-ap-template.xlsx` - Fournisseurs

### Remplissage des gabarits

**Balance générale** (`opening-balance-template.xlsx`) :
- Liste de tous les comptes avec leurs soldes au 31/12/2025
- Débit et crédit doivent s'équilibrer
- Exemple : Capital social, réserves, banque, clients, fournisseurs, stock, immobilisations

**Stock** (`opening-stock-template.xlsx`) :
- Liste des produits en inventaire
- Quantités et coûts unitaires
- Comptes comptables associés

**Immobilisations** (`opening-assets-template.xlsx`) :
- Liste des actifs fixes
- Coûts d'acquisition, amortissements cumulés, durée de vie restante

**Clients** (`opening-ar-template.xlsx`) :
- Liste des clients avec soldes débiteurs
- Informations de contact et comptes 411xxx

**Fournisseurs** (`opening-ap-template.xlsx`) :
- Liste des fournisseurs avec soldes créditeurs
- Informations de contact et comptes 401xxx

## 2. Tests préalables

### Depuis l'application

Pour chaque fichier :

1. sélectionner le fichier Excel
2. cliquer sur **Prévisualiser**
3. corriger les erreurs affichées si nécessaire
4. cliquer sur **Importer** seulement lorsque le rapport est valide

### Depuis le terminal

Avant tout import réel, testez avec le mode dry-run :

```bash
# Test balance
npm run opening:balance -- --file scripts/templates/opening-balance-template.xlsx --date 2026-01-01 --dry-run

# Test stock
npm run opening:stock -- --file scripts/templates/opening-stock-template.xlsx --date 2026-01-01 --dry-run

# Test clients
npm run opening:ar -- --file scripts/templates/opening-ar-template.xlsx --date 2026-01-01 --dry-run

# Test fournisseurs
npm run opening:ap -- --file scripts/templates/opening-ap-template.xlsx --date 2026-01-01 --dry-run

# Test immobilisations
npm run opening:assets -- --file scripts/templates/opening-assets-simulation.xlsx --date 2026-01-01 --dry-run
```

Le dry-run affiche un aperçu JSON sans modifier la base de données.

## 3. Import définitif

Importez dans l'ordre suivant :

### 1. Balance générale

```bash
npm run opening:balance -- --file scripts/templates/opening-balance-template.xlsx --date 2026-01-01
```

**Résultat attendu** : Journal d'ouverture créé (JRN-XXXXXX) avec écritures équilibrées.

### 2. Stock

```bash
npm run opening:stock -- --file scripts/templates/opening-stock-template.xlsx --date 2026-01-01
```

**Résultat attendu** : Produits créés, inventaire valorisé avec CUMP.

### 3. Clients

```bash
npm run opening:ar -- --file scripts/templates/opening-ar-template.xlsx --date 2026-01-01
```

**Résultat attendu** : Clients créés avec soldes débiteurs.

### 4. Fournisseurs

```bash
npm run opening:ap -- --file scripts/templates/opening-ap-template.xlsx --date 2026-01-01
```

**Résultat attendu** : Fournisseurs créés avec soldes créditeurs.

### 5. Immobilisations

```bash
npm run opening:assets -- --file scripts/templates/opening-assets-simulation.xlsx --date 2026-01-01
```

**Résultat attendu** : Actifs créés avec amortissements et écritures comptables.

## 4. Vérifications post-import

Après tous les imports, vérifiez l'intégrité :

```bash
# Smoke complet des imports d'ouverture
npm run test:opening

# Balance générale équilibrée
npm run ledger:balance

# Valorisation stock cohérente
npm run test:inventory-flow

# Lettrage des comptes valide
npm run test:ledger-lettering

# Intégrité journal confirmée
node --env-file=.env.local scripts/test-journal-integrity.js

# Mouvements monétaires cohérents
npm run test:money-movement

# Balances factures équilibrées
npm run audit:invoice-balances
```

## 5. Dépannage

### Erreur "Duplicata détecté"

**Cause** : Tentative de ré-import de données déjà présentes.
**Solution** : Vérifiez les données existantes ou utilisez une société différente.

### Erreur "Balance non équilibrée"

**Cause** : Total débit ≠ total crédit dans la balance.
**Solution** : Vérifiez les montants et corrigez les écarts.

### Erreur "Compte inexistant"

**Cause** : Référence à un compte non créé.
**Solution** : Créez d'abord le plan comptable complet.

### Erreur "Catégorie d'actif inconnue"

**Cause** : Code de catégorie d'immobilisation non défini.
**Solution** : Vérifiez la table `AssetCategory` et les mappings comptes.

## Annexe : Formats des fichiers Excel

### Balance générale (feuille "Balance")

| accountNumber | label | debit | credit |
|---------------|-------|-------|--------|
| 101000 | Capital social |  | 50000 |
| 512000 | Banque | 25000 |  |
| 411100 | Clients | 15000 |  |

### Stock (feuille "Stock")

| sku | name | qty | unitCost | inventoryAccountNumber | stockVariationAccountNumber |
|-----|------|-----|----------|------------------------|-----------------------------|
| LAPTOP-001 | Ordinateur portable | 5 | 800 | 321000 | 603100 |
| CHAIR-001 | Chaise de bureau | 20 | 150 | 321000 | 603100 |

### Immobilisations (feuille "Immobilisations")

| assetCode | name | categoryCode | acquisitionDate | acquisitionCost | accumulatedDepreciation | remainingLifeMonths | salvage |
|-----------|------|--------------|----------------|-----------------|-------------------------|---------------------|---------|
| IMMO-001 | Bureau | BUREAU | 2020-01-01 | 10000 | 3000 | 60 | 500 |

### Clients (feuille "Clients")

| clientCode | name | email | phone | address | accountNumber | openingBalance |
|------------|------|-------|-------|---------|---------------|----------------|
| CLI-001 | Dupont SARL | contact@dupont.fr | 01.23.45.67.89 | Paris | 411100 | 15000 |

### Fournisseurs (feuille "Fournisseurs")

| supplierCode | name | email | phone | address | accountNumber | openingBalance |
|--------------|------|-------|-------|---------|---------------|----------------|
| FOU-001 | Fournitures Plus | contact@fournitures.fr | 01.98.76.54.32 | Lyon | 401100 | 12000 |

---

## Avancement technique

La phase 5 est exploitable pour un parcours contrôlé. Le chantier restant porte surtout sur l'homogénéisation fine des rapports d'erreurs et la revue métier de la procédure d'ouverture.

### S5-01 ✅ : Enrichissement du support
- Simulation d'actifs avec 12 scénarios (6 nominaux + 6 cas limites)
- Gestion des cas complexes : pas de dépréciation, dépréciation lourde (92%), actifs très récents (3%), valeur résiduelle élevée (40%), expiration proche (2 mois), complexités décimales

### S5-02 ✅ : Harmonisation des templates
- Tous les templates Excel régénérés avec colonnes standardisées
- Balance : 9 lignes équilibrées (70k€)
- Stock : 4 produits (11.75k€)
- AR : 4 clients (51.65k€)
- AP : 4 fournisseurs (47.05k€)

### S5-03 ✅ : Généralisation dry-run
- Flag `--dry-run` ajouté à tous les scripts d'import
- Sortie JSON unifiée pour prévisualisation
- Tests validés pour tous les imports

### S5-04 ✅ : Idempotence et sécurité
- Détection de duplicatas avant import :
  - Actifs : vérification `sourceCode`
  - Stock : unicité SKU
  - AR/AP : comptes existants avec entités liées
  - Balance : équilibre validé (débit = crédit)
- Protection contre ré-imports accidentels

### S5-05 ✅ : Test d'ouverture complète
- `npm run test:opening` couvre les 5 imports (`balance`, `stock`, `AR`, `AP`, `assets`) en dry-run puis import réel sur une société temporaire.
- Le test vérifie les journaux, transactions, tiers ouverts, inventaire, immobilisation et ligne d'amortissement d'ouverture.
- Le test nettoie uniquement la société temporaire créée pour le smoke.

### S5-06 ✅ : Documentation utilisateur
- Guide complet et pédagogique
- Exemples concrets et formats détaillés
- Section dépannage et vérifications
- Historique des développements
