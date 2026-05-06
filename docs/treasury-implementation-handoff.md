# Reprise - Documents et flux de tresorerie

Ce memo reconstruit le fil des travaux en cours a partir de l'etat local du depot, car l'historique de chat "creation de document de tresorerie" n'est pas disponible ici.

## Constat

- Aucun fichier local ne porte explicitement le titre "creation de document de tresorerie".
- Le chantier actif touche surtout la tresorerie, le lettrage, les controles RBAC, le scoping societe et la paie reglee.
- La notion de document de tresorerie semble aujourd'hui couverte par les references de piece `voucherRef`, les autorisations de tresorerie, les avis bancaires et les mouvements consultables via `/treasury/movements/[id]`.

## Etat reconstruit

### Tresorerie

- Les mouvements de tresorerie passent par `createMoneyMovement`.
- `companyId` devient obligatoire sur les fonctions sensibles de tresorerie.
- Les comptes banque/caisse et les soldes sont filtres par societe.
- Les creations de mouvement sont protegees par role:
  - entree: `createCollection`
  - sortie: `createPayment`
- Les paiements clients/fournisseurs directs recoivent aussi des controles de permission.

Fichiers principaux:

- `src/lib/serverActions/money.js`
- `src/app/api/treasury/movements/route.js`
- `src/app/api/invoices/[id]/settle/route.js`
- `src/app/api/incoming-invoices/[id]/settle/route.js`
- `src/app/api/payments/route.js`

### Lettrage

- Le lettrage client/fournisseur evolue vers un lettrage depuis la facture.
- La facture et le ou les paiements partagent une reference `LTR-...`.
- Les cas partiels et multi-paiements sont maintenant documentes comme couverts sur le flux standard.
- Un test de regression `test:lettering-flow` a ete ajoute.

Fichiers principaux:

- `src/lib/lettering/matchPartyInvoice.js`
- `scripts/test-lettering-flow.js`
- `docs/lettering-user-guide.md`
- `docs/project-finalization-roadmap.md`

### Paie et reglements

- Le statut Prisma `PayrollPeriodStatus` a ete etendu avec `SETTLED`.
- Une periode `POSTED` passe en `SETTLED` quand tous les passifs paie sont couverts.
- Les ecrans et agregations traitent `POSTED` et `SETTLED` comme statuts post-comptabilisation.

Fichiers principaux:

- `prisma/schema.prisma`
- `prisma/migrations/20260430225155_payroll_period_settled_status/migration.sql`
- `src/lib/payroll/status.js`
- `src/lib/payroll/settlement.js`
- `src/lib/payroll/aggregatePeriod.js`
- `src/app/payroll/periods/[ref]/page.jsx`

### Securite et RBAC

- Le token admin n'est plus injecte avec une valeur par defaut cote client.
- Le middleware ne bypass plus toutes les actions RBAC avec un token admin; le bypass reste limite aux anciens endpoints tokenises.
- Le role peut etre lu depuis le cookie `user-role`, avec repli `VIEWER` hors mode dev.

Fichiers principaux:

- `src/lib/apiClient.js`
- `src/lib/authz.js`
- `src/middleware.js`

## Verification deja faite

- `npm run lint` passe apres la correction de navigation laterale.

## Prochaines actions conseillees

1. Executer `npx prisma generate`.
2. Appliquer ou verifier la migration `payroll_period_settled_status`.
3. Lancer les tests cibles:
   - `npm run test:lettering-flow`
   - `npm run test:ledger-lettering`
   - `npm run smoke:payroll:fully-settled`
   - `npm run test:money-movement`
4. Verifier manuellement les parcours:
   - creation d'un mouvement de tresorerie entrant et sortant
   - consultation de la piece via `/treasury/movements/[id]`
   - lettrage facture client/fournisseur depuis la facture
   - passage paie `POSTED -> SETTLED`
5. Si l'objectif exact etait de creer un document PDF/print de tresorerie, definir le format attendu:
   - recu de caisse
   - ordre de paiement
   - bon de sortie caisse
   - avis/ordre bancaire
   - fiche mouvement avec signature

