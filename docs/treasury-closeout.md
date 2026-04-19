# Clôture Chantier Trésorerie

## Statut

Le chantier Trésorerie est clôturé côté implémentation, tests métier et nettoyage des données de démonstration.

État final validé :
- mouvements de trésorerie standard maintenus
- paiements fournisseurs et suivi de rapprochement visibles
- petits décaissements hors fournisseur couverts
- avances de mission gérées de bout en bout
- régularisations d'avances comptabilisées sans faux mouvement de caisse
- remboursements de reliquat par employé intégrés
- suivi des avances ouvertes et ancienneté disponible
- base de démonstration nettoyée des dossiers de test mission

## Flux Couverts

### 1. Mouvements de trésorerie

Natures prises en charge :
- `CLIENT_RECEIPT`
- `SUPPLIER_PAYMENT`
- `CASH_PURCHASE`
- `EMPLOYEE_EXPENSE`
- `MISSION_ADVANCE`
- `MISSION_ADVANCE_REFUND`
- `PETTY_CASH_OUT`
- autres flux existants associés, salaires, taxes, transferts

Chaque mouvement pertinent :
- porte une pièce (`supportRef`) ou un bénéficiaire
- est tenanté par société
- génère ses écritures comptables équilibrées

### 2. Paiements fournisseurs

Le module couvre :
- saisie des paiements
- visibilité du statut de lettrage
- identification des paiements non rapprochés
- panel fournisseur enrichi

### 3. Avances de mission

Cycle complet couvert :
1. sortie de trésorerie via `MISSION_ADVANCE`
2. imputation de frais via `MISSION_ADVANCE_REGULARIZATION`
3. remboursement du reliquat via `MISSION_ADVANCE_REFUND`
4. disparition automatique du dossier du panneau des avances ouvertes une fois soldé

## Éléments Techniques Ajoutés

### Schéma / Prisma

Ajouts principaux :
- extension `MoneyMovementKind`
- `employeeId`, `beneficiaryLabel`, `supportRef`
- `relatedAdvanceMovementId`
- modèle `MissionAdvanceRegularization`
- source journal `MISSION_ADVANCE_REGULARIZATION`

Migrations créées :
- [20260417221904_treasury_employee_cash_movements](/c:/Users/Tonton%20G/reactproject/first-compta/prisma/migrations/20260417221904_treasury_employee_cash_movements/migration.sql)
- [20260417224508_mission_advance_regularizations](/c:/Users/Tonton%20G/reactproject/first-compta/prisma/migrations/20260417224508_mission_advance_regularizations/migration.sql)
- [20260417230019_mission_advance_refunds](/c:/Users/Tonton%20G/reactproject/first-compta/prisma/migrations/20260417230019_mission_advance_refunds/migration.sql)

### UI / API

Points principaux :
- [src/app/treasury/page.jsx](/c:/Users/Tonton%20G/reactproject/first-compta/src/app/treasury/page.jsx)
- [src/components/treasury/NewMoneyMovementForm.jsx](/c:/Users/Tonton%20G/reactproject/first-compta/src/components/treasury/NewMoneyMovementForm.jsx)
- [src/components/treasury/MissionAdvanceRegularizationForm.jsx](/c:/Users/Tonton%20G/reactproject/first-compta/src/components/treasury/MissionAdvanceRegularizationForm.jsx)
- [src/components/treasury/MissionAdvanceRefundForm.jsx](/c:/Users/Tonton%20G/reactproject/first-compta/src/components/treasury/MissionAdvanceRefundForm.jsx)
- [src/components/treasury/MissionAdvanceOpenPanel.jsx](/c:/Users/Tonton%20G/reactproject/first-compta/src/components/treasury/MissionAdvanceOpenPanel.jsx)
- [src/app/api/treasury/movements/route.js](/c:/Users/Tonton%20G/reactproject/first-compta/src/app/api/treasury/movements/route.js)
- [src/app/api/treasury/mission-advances/open/route.js](/c:/Users/Tonton%20G/reactproject/first-compta/src/app/api/treasury/mission-advances/open/route.js)
- [src/app/api/treasury/mission-advance-regularizations/route.js](/c:/Users/Tonton%20G/reactproject/first-compta/src/app/api/treasury/mission-advance-regularizations/route.js)
- [src/app/api/treasury/summary/route.js](/c:/Users/Tonton%20G/reactproject/first-compta/src/app/api/treasury/summary/route.js)

## Contrôles Disponibles

Tests métier :
- `npm run test:money-movement`
- `npm run test:mission-advance-regularization`
- `npm run test:mission-advance-refund`
- `npm run test:treasury:recipe`

Audits :
- `npm run audit:supplier-payments`
- `npm run audit:treasury:employee-movements`
- `npm run audit:mission-advance-regularizations`
- `npm run audit:open-mission-advances`

Documentation d’exploitation :
- [docs/treasury-operations.md](/c:/Users/Tonton%20G/reactproject/first-compta/docs/treasury-operations.md)

## Résultat de Recette

Dernier état validé :
- `0` caisse négative
- `0` paiement fournisseur non rapproché
- `0` avance de mission ouverte
- `0` avance mission critique `>90j`

Commande de gate :

```bash
npm run test:treasury:recipe
```

## Nettoyage Réalisé

Les dossiers de test mission créés pendant la validation ont été supprimés proprement via :

```bash
node --env-file=.env.local scripts/cleanup-test-mission-advance-data.js --company="Strategic Business Démo" --apply
```

Le script supprime :
- mouvements mission de test
- régularisations liées
- remboursements liés
- journaux et transactions associés
- employés de test devenus inutiles
- comptes de test devenus inutiles

## Procédure d’Exploitation Mensuelle

Avant clôture ou revue mensuelle :

```bash
npm run test:treasury:recipe
npm run audit:open-mission-advances
npm run audit:supplier-payments
```

En cas d’alerte :
- traiter d’abord les caisses négatives
- rapprocher les paiements fournisseurs non lettrés
- solder ou justifier les avances de mission ouvertes

## Conclusion

Le module Trésorerie est désormais exploitable avec :
- une couverture métier élargie
- une traçabilité comptable cohérente
- des écrans de pilotage
- une gate de recette répétable
- une base nettoyée des cas de démonstration
