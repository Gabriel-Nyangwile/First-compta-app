# Sécurité / RBAC (rôles et permissions)

## Rôles supportés
- `PLATFORM_ADMIN` : administration plateforme, création de sociétés et gestion globale des utilisateurs.
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
- Production : `manageProduction`.
- Admin : `manageUsers`, `manageRoles`, `createCompany`.

## Sources du rôle (dev vs prod)
`getUserRole` lit le cookie `user-role` posé après connexion.

En mode dev (`AUTH_DEV_MODE=1`), il accepte aussi :
1) Header `x-user-role`
2) `DEFAULT_ROLE` (`VIEWER` par défaut)

En production, les endpoints métier récupèrent aussi l'utilisateur via le cookie `user-id` et vérifient ses `CompanyMembership` actifs.

## Middleware / API
Le middleware (`src/middleware.js`) protège les routes API mutantes en vérifiant le rôle/perm. `x-admin-token` reste un bypass en dev si configuré. HTTP 403 si insuffisant.

## UI
- Sidebar : les groupes de menu sont filtrés par rôle.
- `PLATFORM_ADMIN` et `SUPERADMIN` voient les pages d'administration.
- Les utilisateurs métier doivent être rattachés à la société active via `CompanyMembership`.
- UI admin utilisateurs : CRUD rôles/activation/reset MDP/suppression, avec pagination/recherche.

## Matrice UI recommandée

| Rôle | Menus principaux |
| --- | --- |
| `PLATFORM_ADMIN` | Analyse, Paramètres |
| `SUPERADMIN` | Tous les modules métier et Paramètres |
| `FINANCE_MANAGER` | Comptabilité, Analyse, Ventes, Achats, Production, Lettrage, Immobilisations, Capital, Trésorerie, Paie |
| `ACCOUNTANT` | Comptabilité, Analyse, Achats, Production, Lettrage, Immobilisations, Capital |
| `PROCUREMENT` | Analyse, Achats, Production, Immobilisations |
| `SALES` | Analyse, Ventes |
| `HR_MANAGER` | Gestion du personnel, Analyse, Paie |
| `PAYROLL_CLERK` | Analyse, Paie |
| `TREASURY` | Analyse, Lettrage, Trésorerie |
| `VIEWER` | Analyse |

## Bonnes pratiques
- Toujours définir `DEFAULT_ROLE` / `user-role` en local si vous testez les actions protégées sans session.
- En prod, s’assurer que la session utilisateur expose `role` et mettre à jour `getUserRole` pour la lire.
- Ne pas utiliser le header `x-admin-token` en prod (uniquement dev/ops).
