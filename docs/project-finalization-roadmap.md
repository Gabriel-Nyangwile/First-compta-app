# Roadmap de finalisation du projet

Ce document sert de feuille de route opérationnelle pour finaliser le projet à partir de l'état actuel.

Il complète le plan par sprint de [project-pilotage-sprints.md](./project-pilotage-sprints.md) en réordonnant les priorités selon les risques restants : lettrage, multi-société, RBAC, paie, reprises d'ouverture, exploitation et documentation finale.

## 1. Objectif de finalisation

Le projet sera considéré comme finalisable lorsque les conditions suivantes seront réunies :

| Domaine | Condition de sortie |
| --- | --- |
| Multi-société | aucune fuite de données entre sociétés |
| Sécurité | accès sensibles protégés par rôle réel |
| Comptabilité | journal, grand livre et lettrage exploitables |
| Paie | cycle `OPEN -> POSTED -> SETTLED` validé |
| Ouverture | nouvelle société initialisable avec données d'ouverture |
| Exploitation | scripts et audits reproductibles |
| Documentation | guides utilisateur et procédures alignés avec le produit réel |
| Build | `npm run build` stable |

## 2. Ordre de priorité

| Priorité | Chantier | Pourquoi maintenant |
| --- | --- | --- |
| P1 | Lettrage réel client/fournisseur | trou fonctionnel transversal le plus visible |
| P2 | Audit multi-société complet | socle nécessaire avant généralisation |
| P3 | Auth/RBAC production | condition de sécurité avant usage réel |
| P4 | Paie - cycle final | module critique déjà avancé, à verrouiller |
| P5 | Reprises d'ouverture | indispensable pour onboarder de nouvelles sociétés |
| P6 | Scripts et audits d'exploitation | rend le projet opérable sans assistance permanente |
| P7 | CI et documentation finale | industrialisation et transmission |

## 3. Phase 1 - Stabiliser le lettrage

### Objectif

Obtenir un vrai lettrage métier :

- facture fournisseur ↔ paiement fournisseur
- facture client ↔ encaissement client
- passif paie ↔ règlement paie

### Travaux réalisés / à surveiller

| ID | Action | Résultat attendu |
| --- | --- | --- |
| R1-01 | Auditer le modèle actuel `Transaction.letterRef`, `letterStatus`, `letteredAmount` | règles actuelles documentées |
| R1-02 | Corriger le lettrage fournisseur pour rattacher facture et paiement | fait: facture et paiement partagent `LTR-...` |
| R1-03 | Corriger le lettrage client pour rattacher facture et encaissement | fait: créance et encaissement partagent `LTR-...` |
| R1-04 | Gérer les paiements partiels | fait: statut `PARTIAL` fiable sur reliquat |
| R1-05 | Gérer plusieurs paiements pour une facture | fait: passage à `MATCHED` quand le solde est couvert |
| R1-06 | Afficher clairement le reste à lettrer | fait côté panneaux client/fournisseur |
| R1-07 | Tester fournisseurs, clients et paie | en cours: script `test:lettering-flow` ajouté côté client/fournisseur |

### Critères de sortie

- une facture de `100` payée `100` devient `MATCHED`
- une facture de `100` payée `60` devient `PARTIAL`, reste `40`
- une facture de `100` payée `60 + 40` devient `MATCHED`
- un paiement sans facture reste identifiable comme non affecté
- `npm run test:lettering-flow` passe
- `npm run test:ledger-lettering` passe
- audit manuel du grand livre cohérent

## 4. Phase 2 - Audit multi-société

### Objectif

Garantir que chaque société ne voit et ne modifie que ses propres données.

### Travaux à faire

| ID | Action | Résultat attendu |
| --- | --- | --- |
| R2-01 | Inventorier toutes les routes API critiques | liste complète |
| R2-02 | Rechercher toutes les requêtes Prisma sans `companyId` | rapport des écarts |
| R2-03 | Corriger les routes sans garde société | routes isolées |
| R2-04 | Vérifier les pages serveur critiques | aucun écran critique sans société |
| R2-05 | Vérifier les séquences par société | pas de collision de références |
| R2-06 | Auditer les scripts import/backfill/audit | scripts compatibles société |
| R2-07 | Tester deux sociétés avec données séparées | zéro fuite |

### Critères de sortie

- toutes les routes financières utilisent `requireCompanyId` ou équivalent
- toutes les requêtes métier critiques filtrent par `companyId`
- les séquences `INV`, `PO`, `JRN`, `PP`, `LTR` sont scopées société
- les tests multi-société passent

## 5. Phase 3 - Authentification et RBAC production

### Objectif

Supprimer les ambiguïtés dev/prod sur les droits d'accès.

### Travaux à faire

| ID | Action | Résultat attendu |
| --- | --- | --- |
| R3-01 | Cartographier les actions sensibles | matrice action/rôle |
| R3-02 | Vérifier `getUserRole` et session réelle | rôle lu sans fallback fragile |
| R3-03 | Limiter les tokens admin au contexte prévu | pas de bypass prod abusif |
| R3-04 | Protéger les routes mutantes | 403 sur rôle non autorisé |
| R3-05 | Cacher/désactiver les boutons non autorisés | UI alignée serveur |
| R3-06 | Tester rôles principaux | scénarios validés |
| R3-07 | Mettre à jour `docs/security-rbac.md` | doc exploitable |

### Critères de sortie

- un utilisateur non autorisé ne peut pas poster, supprimer, régler ou clôturer
- l'UI ne propose pas d'action interdite
- les tests de rôles couvrent au minimum `ADMIN`, `ACCOUNTANT`, `HR_MANAGER`, `PAYROLL_CLERK`, `TREASURY`

## 6. Phase 4 - Paie robuste et clôture complète

### Objectif

Verrouiller le cycle mensuel de paie de bout en bout.

### Travaux à faire

| ID | Action | Résultat attendu |
| --- | --- | --- |
| R4-01 | Revalider les hypothèses IPR/CNSS/ONEM/INPP | règles métier figées |
| R4-02 | Comparer bulletins vs posting paie | aucun écart |
| R4-03 | Tester devise de traitement vs devise fiscale `CDF` | conversion maîtrisée |
| R4-04 | Tester règlements salariés | net payé et lettré |
| R4-05 | Tester règlements organismes | passifs sociaux/fiscaux réglés |
| R4-06 | Tester cycle `OPEN -> POSTED -> SETTLED` | cycle complet validé |
| R4-07 | Consolider guide utilisateur paie | procédure mensuelle prête |

### Critères de sortie

- génération bulletins OK
- PDF bulletins OK
- posting paie équilibré
- passifs paie cohérents
- règlements lettrés
- période suivante créée automatiquement
- build OK

## 7. Phase 5 - Reprises d'ouverture

### Objectif

Permettre l'initialisation propre d'une nouvelle société.

### Travaux à faire

| ID | Action | Résultat attendu |
| --- | --- | --- |
| R5-01 | Finaliser import balance d'ouverture | comptes initialisés |
| R5-02 | Finaliser import stock d'ouverture | stock initial cohérent |
| R5-03 | Finaliser import clients/fournisseurs ouverts | AR/AP repris |
| R5-04 | Finaliser import immobilisations | registre immos initialisé |
| R5-05 | Harmoniser templates Excel | modèles utilisables |
| R5-06 | Ajouter dry-run et rapport d'erreurs | import sécurisé |
| R5-07 | Garantir idempotence ou garde anti-doublons | ré-import maîtrisé |
| R5-08 | Tester ouverture complète société | balance + stock + AR/AP + immos OK |
| R5-09 | Documenter procédure d'ouverture | guide exécutable |

### Critères de sortie

- une société vierge peut être ouverte sans intervention développeur
- les imports produisent un rapport lisible
- les doublons involontaires sont bloqués
- les soldes d'ouverture sont auditables

## 8. Phase 6 - Scripts et exploitation

### Objectif

Rendre les contrôles techniques et métier reproductibles.

### Travaux à faire

| ID | Action | Résultat attendu |
| --- | --- | --- |
| R6-01 | Cataloguer tous les scripts | fait: inventaire complet dans `docs/scripts-inventory.md` |
| R6-02 | Classer critique / utile / legacy | fait: classification par famille et criticité |
| R6-03 | Harmoniser les options CLI | fait: conventions documentées dans `docs/technical-operations-guide.md` |
| R6-04 | Définir packs d'audit par domaine | fait: runner `scripts/run-audit-pack.js` et commandes `audit:pack:*` |
| R6-05 | Nettoyer scripts obsolètes | fait: registre legacy/dangereux ajouté, suppressions différées documentées |
| R6-06 | Rédiger guide exploitation technique | fait: guide exploitation ajouté |

### Packs d'audit recommandés

| Pack | Scripts cibles |
| --- | --- |
| Paie | audit config, devise, IPR, posting, settlement |
| Comptabilité | journal, grand livre, lettrage |
| Trésorerie | mouvements, fournisseurs, avances |
| Stock | inventaire, CUMP, sorties |
| Multi-société | isolation runtime, onboarding |
| Ouverture | imports d'ouverture, clôture annuelle |

### Commandes disponibles

| Domaine | Commande |
| --- | --- |
| Liste des packs | `npm run ops:packs` |
| Contrôle rapide | `npm run audit:pack:quick` |
| Comptabilité | `npm run audit:pack:accounting` |
| Paie | `npm run audit:pack:payroll` |
| Trésorerie | `npm run audit:pack:treasury` |
| Stock | `npm run audit:pack:stock` |
| Multi-société | `npm run audit:pack:multi-company` |
| Ouverture / clôture | `npm run audit:pack:opening` |

## 9. Phase 7 - CI et documentation finale

### Objectif

Industrialiser la livraison et figer la documentation produit.

### Travaux à faire

| ID | Action | Résultat attendu |
| --- | --- | --- |
| R7-01 | Définir pipeline CI minimal | build stable |
| R7-02 | Ajouter lint + smoke critiques | contrôle rapide |
| R7-03 | Séparer suite courte et suite complète | stratégie claire |
| R7-04 | Mettre à jour README fonctionnel | README fidèle |
| R7-05 | Mettre à jour changelog | historique clair |
| R7-06 | Relire guides utilisateur | docs alignées |
| R7-07 | Préparer checklist release | décision go/no-go |

### Critères de sortie

- `npm run build` passe
- suite courte passe
- suite complète documentée
- README et docs clés à jour
- procédure release claire

## 10. Definition of Done globale

Le projet est prêt pour finalisation lorsque :

1. le lettrage client/fournisseur est fonctionnel métier
2. l'isolation multi-société est auditée
3. les rôles prod sont appliqués côté UI et API
4. la paie complète est validée jusqu'au règlement
5. l'ouverture société est testée
6. les scripts critiques sont catalogués
7. les packs d'audit sont reproductibles
8. le build passe
9. la documentation utilisateur et exploitation est alignée
10. une checklist release permet une décision go/no-go

## 11. Suivi recommandé

Mettre à jour ce tableau à chaque session.

| Phase | Statut | Dernier résultat | Prochaine action |
| --- | --- | --- | --- |
| Phase 1 - Lettrage | En cours avancé | lettrage facture-paiement implémenté et testé côté client/fournisseur | consolider audits finaux et couverture paie |
| Phase 2 - Multi-société | Clôture technique OK | routes critiques, server actions et scripts sensibles scopés société | tests croisés deux sociétés |
| Phase 3 - RBAC | Clôture technique OK | mutations critiques protégées côté serveur, build OK | revue UI fine des boutons interdits |
| Phase 4 - Paie | En cours renforcé | statut persistant `SETTLED`, build OK, guide mis à jour | exécuter smokes période totalement réglée |
| Phase 5 - Ouverture | Clôture technique OK | écran `/opening`, écran `/closing`, imports API, à-nouveaux N+1, verrouillage exercice et smokes `test:opening`/`test:closing` OK | revue métier finale des modèles d'import |
| Phase 6 - Exploitation | En cours avancé | inventaire scripts, classification, runner de packs et guide exploitation ajoutés | revue des scripts legacy avant suppression |
| Phase 7 - CI/docs | À faire | build local OK | définir CI minimale |
