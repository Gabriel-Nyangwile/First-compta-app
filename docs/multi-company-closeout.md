# Multi-Company Closeout

## Statut

Le chantier multi-sociétés est clôturé côté implémentation, durcissement structurel et validation.

État final:
- séparation utilisateurs / sociétés / transactions en place
- contrôle de création de société réservé et approuvé
- rôles plateforme et rôles société séparés
- Prisma durci sur les modèles critiques
- garde-fous backend appliqués sur les parcours sensibles
- tests multi-sociétés ajoutés et intégrés à la validation
- reliquat historique de `Strategic Business Démo` traité

## Résultat Final

La gate de recette globale passe:

```bash
npm run test:release:multi-company
```

Dernier état validé:
- multi-company isolation: OK
- multi-company runtime: OK
- onboarding flow: OK
- journal integrity: OK
- ledger balance: OK
- audit multi-company: OK

## Décisions Structurantes

- `PLATFORM_ADMIN` porte les droits plateforme
- `CompanyMembership` porte les droits société
- le signup public crée un utilisateur inactif en attente
- le `PLATFORM_ADMIN` approuve l’utilisateur
- l’utilisateur approuvé reçoit un droit temporaire `canCreateCompany`
- après création de sa société, il devient `SUPERADMIN` de cette société uniquement

## Scripts Utiles

Validation:
- `npm run test:multi-company`
- `npm run test:multi-company:runtime`
- `npm run test:multi-company:onboarding`
- `npm run test:multi-company:all`
- `npm run test:release:multi-company`

Administration:
- `node --env-file=.env scripts/promote-platform-admin.js --email=<email> --apply`

Diagnostic:
- `node --env-file=.env.local scripts/audit-multi-company.js`
- `node --env-file=.env.local scripts/test-journal-integrity.js`
- `node --env-file=.env.local scripts/ledger-balance.js`

Historique / reprise:
- `node --env-file=.env.local scripts/rebuild-empty-asset-journals.js --companyId <id> --dry-run`
- `node --env-file=.env.local scripts/cleanup-historical-empty-journals.js --companyId <id> --dry-run`

## Sauvegardes et Archives

Les nettoyages historiques ont généré des archives JSON dans `backups/`, notamment:
- archives des journaux vides supprimés
- exports intermédiaires de diagnostic selon les scripts exécutés

Ces fichiers doivent être conservés comme trace de reprise.

## Points de Vigilance

- toute nouvelle suppression métier doit continuer à nettoyer ou préserver correctement les journaux liés
- les scripts d’admin destructifs doivent rester scope société et utiliser dry-run par défaut
- `User.companyId` reste un champ legacy de compatibilité; la source d’appartenance est `CompanyMembership`
- en cas d’incident, utiliser d’abord:
  - `audit-multi-company`
  - `test-journal-integrity`
  - `ledger-balance`

## Recommandation d’Exploitation

Avant toute mise à jour impactante:

```bash
npm run test:release:multi-company
```

Après tout changement touchant auth, sociétés, journal ou données comptables:

```bash
npm run test:multi-company:all
```

## Conclusion

Le logiciel est désormais exploitable en mode multi-sociétés étanche sur la base validée, avec une gate technique répétable et un historique comptable nettoyé.
