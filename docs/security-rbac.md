# Sécurité / RBAC (rôles et permissions)

## Rôles supportés
- `SUPERADMIN` : tous les droits, administration et configuration.
- `FINANCE_MANAGER` : validation achats/ventes, immobilisations, clôtures, trésorerie.
- `ACCOUNTANT` : compta opérationnelle, immobilisations, journal.
- `PROCUREMENT` : achats/BC/BR (sans validation critique).
- `SALES` : devis/commandes/factures clients (sans validation critique).
- `HR_MANAGER` : RH/paie complet.
- `PAYROLL_CLERK` : préparation paie (pas de clôture).
- `TREASURY` : paiements/encaissements/rapprochements.
- `VIEWER` : lecture seule.

La normalisation des rôles est effectuée en majuscules, remplaçant espaces/tirets par `_`.

## Permissions principales (permMap)
- Immobilisations : `createAsset`, `approveAssetPO`, `receiveAssetPO`, `generateAssetInvoice`, `postDepreciation`, `lockDepreciation`, `createAssetPO`.
- Achats : `createPurchaseOrder`, `approvePurchaseOrder`, `receivePurchaseOrder`, `createIncomingInvoice`, `approveIncomingInvoice`.
- Ventes : `createSalesOrder`, `approveSalesOrder`, `createSalesInvoice`, `approveSalesInvoice`.
- Trésorerie : `createPayment`, `approvePayment`, `createCollection`, `approveCollection`, `reconcile`, `createMoneyMovement`.
- RH/Paie : `manageEmployees`, `managePayroll`, `approvePayroll`.
- Stock : `manageInventory`, `manageProducts`.
- Comptabilité : `postJournalEntry`, `reopenPeriod`, `exportAccounting`.
- Admin : `manageUsers`, `manageRoles`.

## Sources du rôle (dev vs prod)
`getUserRole` lit, dans l’ordre :
1) Header `x-user-role` (si `AUTH_DEV_MODE=1`)
2) Cookie `user-role` (si `AUTH_DEV_MODE=1`)
3) `DEFAULT_ROLE` (`VIEWER` par défaut, si `AUTH_DEV_MODE=1`)

En production (`AUTH_DEV_MODE` désactivé), brancher sur la session d’auth (NextAuth/JWT) au lieu de ces fallback, et ne pas utiliser `x-admin-token`.

## Middleware / API
Le middleware (`src/middleware.js`) protège les routes API mutantes en vérifiant le rôle/perm. `x-admin-token` reste un bypass en dev si configuré. HTTP 403 si insuffisant.

## UI
- Sidebar : le lien `/admin/users` n’apparaît que pour `SUPERADMIN`.
- Actions serveur critiques (BC immo, facture, etc.) envoient `x-user-role` (DEFAULT_ROLE ou SUPERADMIN en dev) pour éviter les 403 liés à l’absence de session.
- UI admin utilisateurs : CRUD rôles/activation/reset MDP/suppression, avec pagination/recherche ; en dev, `x-user-role` est ajouté aux fetch.

## Bonnes pratiques
- Toujours définir `DEFAULT_ROLE` / `user-role` en local si vous testez les actions protégées sans session.
- En prod, s’assurer que la session utilisateur expose `role` et mettre à jour `getUserRole` pour la lire.
- Ne pas utiliser le header `x-admin-token` en prod (uniquement dev/ops).
