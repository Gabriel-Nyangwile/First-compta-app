# Trésorerie - Recette et Exploitation

Pour le mode d'emploi détaillé du module, utiliser en priorité :

- [docs/treasury-user-guide.md](/c:/Users/Tonton%20G/reactproject/first-compta/docs/treasury-user-guide.md)

Le présent document reste centré sur la recette, les audits et les contrôles d'exploitation.

## Objectif

Ce document couvre la recette métier et les contrôles d'exploitation du module Trésorerie:
- règlements fournisseurs
- mouvements de caisse et petits décaissements
- avances de mission
- régularisations et remboursements de reliquat

## Commandes de contrôle

Contrôles ciblés:

```bash
npm run test:money-movement
npm run test:mission-advance-regularization
npm run test:mission-advance-refund
npm run audit:supplier-payments
npm run audit:treasury:employee-movements
npm run audit:mission-advance-regularizations
npm run audit:open-mission-advances
```

Gate de recette Trésorerie:

```bash
node --env-file=.env.local scripts/test-treasury-recipe.js
```

## Check-list métier

1. Vérifier qu'aucune caisse n'est négative.
2. Vérifier les paiements fournisseurs non rapprochés.
3. Vérifier les avances de mission ouvertes.
4. Vérifier les avances de mission critiques `>90j`.
5. Vérifier qu'un remboursement de reliquat passe bien par un mouvement `MISSION_ADVANCE_REFUND`.
6. Vérifier qu'une régularisation d'avance génère un journal `MISSION_ADVANCE_REGULARIZATION`.

## Signaux d'alerte

- `negativeCashAccountsCount > 0`
- `unmatchedSupplierPaymentsCount > 0`
- `openMissionAdvancesCount > 0`
- `openMissionAdvancesCriticalCount > 0`

Ces indicateurs remontent aussi dans `/api/treasury/summary` et dans la carte Trésorerie du dashboard.

## Procédure de traitement des avances

1. Saisir l'avance avec `MISSION_ADVANCE`.
2. Régulariser les frais justifiés via `Régulariser une avance de mission`.
3. Enregistrer le remboursement du reliquat via `Enregistrer un remboursement d'avance`.
4. Vérifier la disparition de l'avance du panneau `Avances de mission ouvertes`.

## Point d'exploitation

Avant clôture mensuelle, exécuter au minimum:

```bash
node --env-file=.env.local scripts/test-treasury-recipe.js
node --env-file=.env.local scripts/audit-open-mission-advances.js
node --env-file=.env.local scripts/audit-supplier-payments.js --no-exit-error
```
