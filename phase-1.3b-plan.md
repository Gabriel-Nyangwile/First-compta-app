# Phase 1.3b — Journal & Grand Livre

## 1. Objectifs Fonctionnels

- Journal exhaustif avec pagination, filtres (date, source, recherche), affichage détaillé des lignes (compte, TVA, libellé).
- Grand livre détaillé par compte (lettrage, soldes intermédiaires, filtres période/compte, exports CSV/PDF).
- Contrôles comptables : balance générale (trial balance), équilibres journaux, scripts d’audit récurrents.
- Préparation lettrage (identifiant de lettrage, rapprochement client/fournisseur, statut de lettrage visible en UI).

## 2. État Actuel Synthétique

- **Journal** : page `/journal` liste les écritures avec totaux, API `/api/journal-entries` (filtres limités). Pas de détail ligne, pas de pagination côté UI.
- **Grand Livre** : `/ledger` agrège par compte; `/api/ledger` et `/api/trial-balance` fournissent les agrégats. Pas de vue détaillée ligne par ligne ni lettrage.
- **Back-end** : `src/lib/journal.js` gère `finalizeBatchToJournal` + backfill; journal équilibré (test-journal-integrity OK). Manque séquence safe dans scripts legacy (à corriger au besoin).
- **Scripts dispo** : `test-journal-integrity.js`, `ledger-balance.js`, `export-trial-balance.js` (à harmoniser si nécessaire).

## 3. Gaps & Points d’Évolution

- **Schéma / Données**
  - Introduire champs pour lettrage (ex. `letterRef`, `letterStatus`) sur `Transaction` ou table dédiée.
  - Prévoir `JournalEntryLine` ou enrichir `Transaction` pour afficher compte/libellé dans le journal.
  - Vérifier séquence `JRN` (scripts backfill, OD) pour éviter conflits.

- **API**
  - `/api/journal-entries` : ajouter pagination + filtres avancés (sourceId, numéro, search full-text), renvoyer détails (transactions, comptes, TVA).
  - `/api/journal-entries/[id]` : exposer détail complet (lignes, liens source).
  - `/api/ledger` et `/api/ledger/[accountId]` : aligner format, inclure lettrage, soldes période, options export.
  - `/api/trial-balance` : prévoir formats supplémentaires (PDF), paramètre `includeZero=false`.

- **UI**
  - `/journal` : transformer en layout App Router (server component + client filters), table responsive avec colonnes compte, débit, crédit, solde, badge lettrage, pagination.
  - `/journal/[id]` : page détail d’écriture (lignes, liens, actions). Fichier existant à auditer.
  - `/ledger` : UI modernisée (cards, filtres sticky, export). Ajouter lettrage visuel, lien direct vers le détail d’écriture.
  - `/ledger/[accountId]` : page détaillée (déjà présente ?) à enrichir (tri, search, lettrage).

- **Flux & Scripts**
  - Garantir appel `finalizeBatchToJournal` pour chaque flux (autorisation trésorerie, retours, OD, import). Ajouter tests de non-régression.
  - Réécrire `scripts/backfill-journal-entry.js` pour utiliser `nextSequence` et éviter P2002.
  - Ajouter script `audit-ledger-lettrage.js` pour vérifier lettrage complet.

- **Tests & Qualité**
  - Tests automatisés : compléter `test-journal-integrity.js`, créer `test-ledger-balance.js`, snapshots export CSV.
  - Documenter ordre d’exécution post-déploiement (`verify-prisma` → migrate → `test-journal-integrity` → `ledger-balance` → audit).

## 4. Roadmap Technique (Proposition)

1. Audit & design : valider modèle lettrage, définir DTO API, maquettes UI rapides.
2. Mises à jour schéma/ORM : migrations (lettre, champs supplémentaires), adaptateurs Prisma.
3. API layer : étendre routes journal/ledger, tests unitaires.
4. UI : refonte pages `/journal`, `/ledger`, `/journal/[id]`, `/ledger/[accountId]`.
5. Scripts & tests : backfill séquence, nouveaux audits, mise à jour doc.
6. Validation : exécuter scripts (`test-journal-integrity`, `ledger-balance`, `export-trial-balance`), QA manuelle.

## 5. Backlog Ouvert / Questions

- Quelle granularité pour lettrage (champ sur Transaction vs table dédiée) ?
- Besoin d’un export PDF pour journal ? (phase 1.3b mentionne « reporting »).
- Gestion des écritures manuelles (OD) : workflow UI et journalisation prévue ?
- Règles TVA multi-taux : journal doit-il afficher ventilations par taux ?

---

Suivant : valider ces axes avec le PO/règles comptables, puis lancer l’étape 1 (audit approfondi + design lettrage).
