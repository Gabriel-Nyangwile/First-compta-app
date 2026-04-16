# Pilotage projet — plan d’exécution par sprint

## Vue d’ensemble

Ce document sert de support de pilotage opérationnel pour exécuter les priorités du projet sprint par sprint.

### Priorités structurantes

1. Multi-société de bout en bout
2. Authentification production et RBAC
3. Journal, grand livre et lettrage
4. Stabilisation de la paie
5. Reprises d’ouverture
6. Rationalisation des scripts et de l’exploitation
7. CI, couverture et documentation

### Légende

- **Charge** : S / M / L
- **Statut initial** : À lancer
- **Validation** : critère concret de fin

---

## Sprint 1 — Multi-société

### Objectif

Garantir l’isolation complète des données par société sur les routes, pages, services et scripts.

### Tableau de pilotage

| ID | Tâche | Domaine | Dépendances | Charge | Statut | Validation |
|---|---|---|---|---|---|---|
| S1-01 | Inventorier toutes les routes/API critiques | API | aucune | M | À lancer | liste complète validée |
| S1-02 | Auditer les requêtes Prisma sans `companyId` | Data | S1-01 | L | À lancer | rapport des écarts |
| S1-03 | Uniformiser la récupération de la société active | Infra | aucune | M | À lancer | une seule logique `tenant` utilisée |
| S1-04 | Bloquer les écrans serveur sans société active | UI serveur | S1-03 | S | À lancer | aucun écran critique sans garde |
| S1-05 | Vérifier les séquences par société | Métier | S1-02 | M | À lancer | aucune collision inter-sociétés |
| S1-06 | Auditer scripts `import/backfill/audit` pour le scope société | Ops | S1-02 | L | À lancer | scripts critiques conformes |
| S1-07 | Tester 2 sociétés avec jeux de données séparés | QA | S1-02 à S1-06 | M | À lancer | zéro fuite inter-sociétés |
| S1-08 | Documenter la procédure “société active” | Doc | S1-03 | S | À lancer | note d’exploitation disponible |

### Sortie attendue

- isolation des données par société fiable ;
- scripts critiques compatibles multi-société.

---

## Sprint 2 — Authentification prod + RBAC

### Objectif

Supprimer la dépendance aux bypass dev pour les flux sensibles et fiabiliser les permissions.

### Tableau de pilotage

| ID | Tâche | Domaine | Dépendances | Charge | Statut | Validation |
|---|---|---|---|---|---|---|
| S2-01 | Cartographier tous les points d’autorisation | Sécurité | S1-01 | M | À lancer | matrice actions/rôles |
| S2-02 | Brancher `getUserRole` sur une session réelle | Sécurité | aucune | M | À lancer | rôle lu côté prod sans fallback dev |
| S2-03 | Limiter `x-admin-token` au dev/ops | Sécurité | S2-02 | S | À lancer | bypass indisponible en prod |
| S2-04 | Vérifier le middleware sur routes mutantes | API | S2-01 | M | À lancer | 403 sur accès non autorisé |
| S2-05 | Aligner l’UI avec les permissions serveur | UI | S2-01, S2-04 | M | À lancer | pas de bouton critique exposé à tort |
| S2-06 | Tester les rôles métier principaux | QA | S2-02 à S2-05 | M | À lancer | scénario par rôle validé |
| S2-07 | Mettre à jour la doc RBAC prod/dev | Doc | S2-02 à S2-05 | S | À lancer | doc alignée avec le code |

### Sortie attendue

- auth prod exploitable ;
- permissions cohérentes UI + API.

---

## Sprint 3 — Journal, grand livre, lettrage

### Objectif

Rendre la couche comptable centrale pleinement exploitable pour l’exploitation et l’audit.

### Tableau de pilotage

| ID | Tâche | Domaine | Dépendances | Charge | Statut | Validation |
|---|---|---|---|---|---|---|
| S3-01 | Auditer les gaps du plan journal/ledger | Compta | S1, S2 | M | À lancer | backlog détaillé validé |
| S3-02 | Finaliser pagination et filtres du journal | UI/API | S3-01 | M | À lancer | journal navigable sur gros volumes |
| S3-03 | Ajouter le détail complet d’écriture | Compta UI | S3-01 | M | À lancer | vue écriture exploitable |
| S3-04 | Enrichir le grand livre par compte | Compta UI | S3-01 | M | À lancer | lecture détaillée par compte |
| S3-05 | Harmoniser les liens source ↔ écriture ↔ compte | Métier | S3-03, S3-04 | M | À lancer | navigation bout en bout ok |
| S3-06 | Stabiliser `letterRef` et `letterStatus` | Lettrage | S3-01 | L | À lancer | statuts cohérents |
| S3-07 | Renforcer les audits ledger/lettering | Audit | S3-06 | M | À lancer | scripts sans écart |
| S3-08 | Faire une revue métier comptable | QA métier | S3-02 à S3-07 | M | À lancer | validation comptable formelle |

### Sortie attendue

- couche comptable centrale stabilisée ;
- journal, grand livre et lettrage exploitables.

---

## Sprint 4 — Paie robuste

### Objectif

Faire passer la paie d’un état bêta avancé à un cycle robuste, contrôlé et auditables.

### Tableau de pilotage

| ID | Tâche | Domaine | Dépendances | Charge | Statut | Validation |
|---|---|---|---|---|---|---|
| S4-01 | Revalider les règles de calcul paie | Métier paie | S3 | M | À lancer | hypothèses métier figées |
| S4-02 | Contrôler les postings paie vs bulletins | Compta paie | S4-01 | M | À lancer | pas d’écart posting/bulletin |
| S4-03 | Auditer les règlements salariés et organismes | Trésorerie paie | S4-02 | M | À lancer | soldes cohérents |
| S4-04 | Tester les cas limites paie RDC/OHADA | QA métier | S4-01 | M | À lancer | cas limites documentés |
| S4-05 | Formaliser la procédure mensuelle paie | Doc ops | S4-02 à S4-04 | S | À lancer | checklist mensuelle disponible |
| S4-06 | Revue finale période `OPEN -> POSTED -> SETTLED` | QA E2E | S4-01 à S4-05 | M | À lancer | cycle complet validé |

### Sortie attendue

- paie auditable ;
- clôture mensuelle paie documentée.

---

## Sprint 5 — Reprises d’ouverture

### Objectif

Rendre l’ouverture d’une nouvelle société complète, testable et documentée.

### Tableau de pilotage

| ID | Tâche | Domaine | Dépendances | Charge | Statut | Validation |
|---|---|---|---|---|---|---|
| S5-01 | Finaliser l’import immobilisations d’ouverture | Opening | S1 | L | À lancer | import immos fonctionnel |
| S5-02 | Harmoniser les templates Excel | Ops | S5-01 | M | À lancer | templates cohérents |
| S5-03 | Ajouter un mode dry-run sur les imports | Qualité | S5-01 | M | À lancer | rapport avant import disponible |
| S5-04 | Sécuriser le ré-import / idempotence | Data | S5-01 | M | À lancer | pas de doublons involontaires |
| S5-05 | Tester l’ouverture complète d’une société | QA E2E | S5-01 à S5-04 | L | À lancer | balance + stock + AR/AP + immos ok |
| S5-06 | Documenter la procédure d’ouverture | Doc | S5-05 | S | À lancer | guide exécutable disponible |

### Sortie attendue

- kit complet d’ouverture comptable.

---

## Sprint 6 — Scripts et exploitation

### Objectif

Rationaliser l’outillage d’exploitation et rendre les séquences de contrôle reproductibles.

### Tableau de pilotage

| ID | Tâche | Domaine | Dépendances | Charge | Statut | Validation |
|---|---|---|---|---|---|---|
| S6-01 | Cataloguer tous les scripts | Ops | S1 à S5 | M | À lancer | inventaire complet |
| S6-02 | Classer scripts critiques / utiles / legacy | Ops | S6-01 | S | À lancer | tri validé |
| S6-03 | Harmoniser options CLI et codes retour | DevEx | S6-01 | M | À lancer | usage uniforme |
| S6-04 | Définir des packs d’audit par domaine | Ops | S6-02 | M | À lancer | séquences d’audit prêtes |
| S6-05 | Nettoyer les scripts obsolètes ou redondants | Maintenance | S6-02 | M | À lancer | dette scripts réduite |
| S6-06 | Rédiger un guide d’exploitation technique | Doc ops | S6-03 à S6-05 | M | À lancer | opérable sans assistance dev |

### Sortie attendue

- exploitation simplifiée ;
- scripts lisibles et fiables.

---

## Sprint 7 — CI, couverture, documentation

### Objectif

Industrialiser la livraison et aligner la documentation sur l’état réel du produit.

### Tableau de pilotage

| ID | Tâche | Domaine | Dépendances | Charge | Statut | Validation |
|---|---|---|---|---|---|---|
| S7-01 | Revoir le pipeline CI minimal et utile | CI | S1 à S6 | M | À lancer | pipeline stable |
| S7-02 | Ajouter lint + smoke critiques | CI | S7-01 | S | À lancer | contrôle rapide systématique |
| S7-03 | Définir suite métier courte vs complète | CI | S7-01 | M | À lancer | stratégie claire |
| S7-04 | Mesurer la couverture utile | Qualité | S7-01 | M | À lancer | baseline de couverture |
| S7-05 | Mettre à jour le README fonctionnel réel | Doc | S1 à S6 | M | À lancer | README fidèle au produit |
| S7-06 | Mettre à jour le changelog | Doc | S7-05 | S | À lancer | historique aligné |
| S7-07 | Documenter les procédures standard | Doc ops | S7-05 | M | À lancer | docs d’exploitation publiées |

### Sortie attendue

- projet industrialisé ;
- documentation réalignée.

---

## Dépendances majeures

| Dépendance | Impact |
|---|---|
| Sprint 1 avant Sprint 3 | le journal/ledger doit être sûr par société |
| Sprint 2 avant généralisation prod | les validations serveur doivent être fiables |
| Sprint 3 avant Sprint 4/5 | le socle comptable doit être stable |
| Sprint 5 avant déploiement client multi-société | onboarding propre indispensable |
| Sprint 6 avant transfert à l’exploitation | autonomie opérationnelle |
| Sprint 7 en clôture | stabilisation maintenance et transmission |

---

## Vue synthétique

| Sprint | But principal | Résultat attendu |
|---|---|---|
| 1 | Multi-société | isolation des données |
| 2 | Auth/RBAC prod | sécurité d’accès fiable |
| 3 | Journal/ledger/lettrage | cœur comptable stabilisé |
| 4 | Paie | cycle paie robuste |
| 5 | Ouverture | reprise initiale complète |
| 6 | Scripts/ops | exploitation simplifiée |
| 7 | CI/doc | industrialisation finale |

---

## Indicateurs de suivi recommandés

| Indicateur | Cible |
|---|---|
| Routes critiques auditées | 100% |
| Scripts critiques multi-société compatibles | 100% |
| Flux sensibles protégés par RBAC | 100% |
| Audits comptables bloquants en échec | 0 |
| Procédures d’exploitation documentées | 100% sur domaines clés |
| Documentation produit réalignée | README + docs clés + changelog |

---

## Pilotage hebdomadaire conseillé

À suivre pour chaque tâche :

- **Responsable**
- **Date cible**
- **Statut courant**
- **Bloqueur**
- **Décision**

Modèle de ligne de suivi :

| Tâche | Responsable | Date cible | Statut courant | Bloqueur | Décision |
|---|---|---|---|---|---|
| Exemple | À définir | YYYY-MM-DD | En cours | Aucun | Continuer |
