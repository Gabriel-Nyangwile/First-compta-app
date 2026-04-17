# Multi-Company Release Checklist

## Objectif

Cette checklist sert de porte de sortie avant généralisation du mode multi-sociétés.  
Elle couvre:
- la santé Prisma
- l'étanchéité multi-sociétés
- les invariants comptables
- la recette fonctionnelle minimale
- le rollback opérationnel

## Pré-requis

- sauvegarde récente disponible dans `backups/`
- environnement `.env.local` pointant vers une base de recette ou une copie de production
- au moins un `PLATFORM_ADMIN` actif
- aucune opération de reprise de données en cours

## Gate Technique

Exécuter dans cet ordre:

```bash
node --env-file=.env.local scripts/verify-prisma.js
npm run test:multi-company:all
node --env-file=.env.local scripts/test-journal-integrity.js
node --env-file=.env.local scripts/ledger-balance.js
node --env-file=.env.local scripts/audit-multi-company.js
```

Critères de succès:
- Prisma répond correctement
- tous les tests multi-sociétés sont verts
- aucun `JournalEntry` vide, orphelin ou déséquilibré dans le périmètre validé
- balance générale cohérente
- aucune relation cross-company détectée

## Recette Fonctionnelle

Scénario 1: onboarding contrôlé
- créer un nouvel utilisateur public
- vérifier qu'il est inactif après signup
- l'approuver via un `PLATFORM_ADMIN`
- vérifier que le droit temporaire de création de société lui est accordé
- créer une nouvelle société avec ce compte
- vérifier la création du `CompanyMembership` en `SUPERADMIN`

Scénario 2: séparation des sociétés
- se connecter sur société A
- créer ou consulter une donnée visible dans A
- se connecter sur société B
- vérifier que la donnée de A n'apparaît pas dans B
- refaire le contrôle sur journal et grand livre

Scénario 3: rôles et droits
- vérifier qu'un `VIEWER` ne peut pas créer une société sans approbation
- vérifier qu'un `SUPERADMIN` de société ne peut pas créer une autre société
- vérifier qu'un `PLATFORM_ADMIN` peut approuver ou rejeter une demande

Scénario 4: comptabilité
- ouvrir journal
- ouvrir grand livre
- vérifier que le nom de la société active est affiché dans la navigation
- vérifier que les écritures affichées appartiennent uniquement à la société active

## Signaux de Blocage

Bloquer la mise en service si l'un des points suivants est observé:
- fuite de données entre sociétés
- `CompanyMembership` absent ou incohérent après approbation
- balance comptable déséquilibrée
- journaux vides recréés après une opération métier
- utilisateur actif sans accès réel à une société

## Rollback

Si un incident est détecté après mise en service:

1. geler les écritures
2. capturer les IDs des sociétés/utilisateurs/écritures concernées
3. exécuter les audits:
   - `audit-multi-company`
   - `test-journal-integrity`
   - `ledger-balance`
4. restaurer la sauvegarde si l'anomalie est structurelle
5. sinon corriger via script ciblé et rejouer la gate technique

## Commande Recommandée

```bash
npm run test:release:multi-company
```

Cette commande regroupe la porte technique minimale de recette avant validation finale.
