# Ouverture des comptes (reprise détaillée)

Date d'ouverture retenue : 2026-01-01.
Mode de reprise : reprise détaillée (stock/immos/AR/AP).
Formats disponibles : Excel pour balance, stock, immobilisations, clients/fournisseurs.

## 1) Templates Excel

Générer les gabarits :

```
npm run opening:templates
```

Fichiers créés :
- `scripts/templates/opening-balance-template.xlsx`
- `scripts/templates/opening-stock-template.xlsx`

## 2) Import balance d'ouverture

Colonnes attendues (feuille "Balance") :
- `accountNumber` (obligatoire)
- `accountLabel` (optionnel)
- `debit` (obligatoire)
- `credit` (obligatoire)

Commande :
```
npm run opening:balance -- --file path\\to\\balance.xlsx --date 2026-01-01
```

Le script crée un journal d'ouverture unique (OD) équilibré.

## 3) Import stock d'ouverture

Colonnes attendues (feuille "Stock") :
- `sku` (obligatoire)
- `name` (requis si le produit n'existe pas encore)
- `qty` (obligatoire)
- `unitCost` (obligatoire)
- `inventoryAccountNumber` (requis si le produit n'existe pas encore)
- `stockVariationAccountNumber` (requis si le produit n'existe pas encore)

Commande :
```
npm run opening:stock -- --file path\\to\\stock.xlsx --date 2026-01-01
```

Notes :
- Pour des produits déjà existants, `sku`, `qty`, `unitCost` suffisent.
- Les écritures comptables de stock sont déjà couvertes par la balance d'ouverture.

## 4) Import immobilisations d'ouverture (prévu)

Colonnes attendues (feuille "Immobilisations") :
- `assetCode` (obligatoire)
- `name` (obligatoire)
- `categoryCode` (obligatoire, doit exister)
- `acquisitionDate` (obligatoire, date)
- `acquisitionCost` (obligatoire)
- `accumulatedDepreciation` (obligatoire)
- `netBookValue` (optionnel si calculé)
- `remainingLifeMonths` (obligatoire)

Commande :
```
npm run opening:assets -- --file path\\to\\assets.xlsx --date 2026-01-01
```

Notes :
- Une écriture d'ouverture sera générée (2xx/28x) selon les catégories.
- La VNC sera calculée si non fournie.

## 5) Import clients/fournisseurs & soldes

### Clients (AR)

Colonnes attendues (feuille "Clients") :
- `clientCode` (obligatoire)
- `name` (obligatoire)
- `accountNumber` (obligatoire, 411xxx)
- `email` (optionnel)
- `phone` (optionnel)
- `address` (optionnel)
- `openingBalance` (obligatoire)

### Fournisseurs (AP)

Colonnes attendues (feuille "Fournisseurs") :
- `supplierCode` (obligatoire)
- `name` (obligatoire)
- `accountNumber` (obligatoire, 401xxx)
- `email` (optionnel)
- `phone` (optionnel)
- `address` (optionnel)
- `openingBalance` (obligatoire)

Commande :
```
npm run opening:ar -- --file path\\to\\clients.xlsx --date 2026-01-01
npm run opening:ap -- --file path\\to\\suppliers.xlsx --date 2026-01-01
```

Notes :
- Possibilité d'importer des factures ouvertes détaillées à la place des soldes agrégés.
- Le script utilise `OPENING_OFFSET_ACCOUNT` (défaut `471000`) pour équilibrer le journal d'ouverture AR/AP.
