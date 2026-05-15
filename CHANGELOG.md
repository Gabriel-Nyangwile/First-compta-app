# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

### Ajouté

- Checklist release go/no-go globale dans `docs/release-checklist.md`.
- Journal de validation release dans `docs/release-validation-log.md`.
- Documentation des gates `ci:quick` et `ci:full` dans les guides d'exploitation.

### Modifié

- README principal et README français réalignés avec le périmètre actuel: multi-société, achats, trésorerie, stock, paie, production, ouverture/clôture et déploiement Vercel/Neon.
- Guides utilisateurs relus pour l'affichage Aide: sections techniques masquées et index séparé entre guides utilisateur et documents d'exploitation.
- Validation Phase 7 consignée: `ci:quick` local OK, `/api/health` Vercel OK, connexions applicatives OK.
- Seed de configuration paie compatible avec le scoping multi-société utilisé en CI.
- Connexion et approbation d'accès stabilisées: liste publique des sociétés indépendante des anciens cookies, rôle `PLATFORM_ADMIN` conservé côté serveur, cookies d'authentification nettoyés à la déconnexion.

## [v0.1.1] - 2025-11-17

### Ajouté

- Tests PO/retour: envoi de l’en-tête d’admin `x-admin-token` quand disponible.
- Fallbacks comptables dans les tests: auto-création des comptes `31*` et `603*`/`701*` si absents.
- PDF: vérification de vivacité via la racine (`/`) quand `/api/health` est indisponible.
- Outils/Payroll (ajoutés par le commit de stabilisation):
  - Migration: `20251117152310_payroll_expat_flag` (flag expatrié).
  - Scripts: `scripts/mark-expatriates.js`, `scripts/seed-cost-centers-nat-exp.js`,
    `scripts/test-payroll-expat-default-cc.js`, `scripts/dev-approve-last-draft-po*.js`.

### Modifié

- `scripts/regression-line-links.js`:
  - Ignore le scénario “facture client sans bon de commande” (désormais interdit).
  - Désactive par défaut le PATCH des factures fournisseur pour éviter la dérive d’audit.
    - Activer optionnellement avec `REGRESSION_PATCH_PURCHASE=1`.
- `package.json`:
  - Suite complète: exécute `audit:invoice-balances:fix` avant l’audit strict.
  - Supprime `test:po-all` (les scripts flow/cancel couvrent déjà les cas).

### Corrigé

- 500 intermittents pendant l’approbation des BC en exécution chaînée (stabilisation des tests et readiness).
- 401 (Unauthorized) dans les tests d’annulation/retour (en-tête admin manquant).
- Dérives de soldes de factures (backfill automatique dans la suite complète + initialisation côté API déjà en place).
- Tests PDF robustes même sans `/api/health` explicite.

### Notes

- `audit:stock` peut afficher des divergences informatives; la suite n’échoue pas sur ces alertes.
- Utiliser `BASE_URL`/`PDF_BASE_URL`/`HEALTH_BASE` pour pointer vers le port actif (souvent `http://localhost:3005`).

[v0.1.1]: https://github.com/Gabriel-Nyangwile/First-compta-app/releases/tag/v0.1.1
[Unreleased]: https://github.com/Gabriel-Nyangwile/First-compta-app/compare/v0.1.1...HEAD
