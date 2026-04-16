# Phase 1.3b-02 : Design & Refactor Journal/Grand Livre

## Objectif
Refactorer l'architecture existante et améliorer l'UX du système journal/ledger tout en préservant la fonctionnalité existante.

## Priorités

### 1. Refactor Architecture (Semaine 1-2) ✅ TERMINÉ
- [x] Extraire logique métier dans `src/lib/journal/` et `src/lib/ledger/`
- [x] Créer DTOs pour filtres et résultats avec validation Zod
- [x] Séparer logique de calcul des totaux et formatage
- [x] Créer utilitaires réutilisables pour les exports

**Fichiers créés :**
- `src/lib/journal/journalFilters.js` - Validation Zod des filtres
- `src/lib/journal/journalService.js` - Logique métier journal
- `src/lib/journal/journalCalculations.js` - Utilitaires calcul/formatage
- `src/lib/journal/journalExports.js` - Génération CSV
- `src/lib/ledger/ledgerFilters.js` - Validation filtres ledger
- `src/lib/ledger/ledgerService.js` - Logique métier ledger
- `src/lib/ledger/ledgerCalculations.js` - Utilitaires calcul/formatage
- `src/lib/ledger/ledgerExports.js` - Génération CSV
- `scripts/test-phase-1.3b-02-services.js` - Tests de validation

**Tests validés :**
- ✅ Validation des filtres avec Zod
- ✅ Services métier fonctionnels
- ✅ Exports CSV opérationnels

### 2. Améliorations UX (Semaine 3-4)
- [ ] Ajouter tri dynamique côté client (React state)
- [ ] Implémenter filtres avancés (range sliders, multi-select)
- [ ] Ajouter vues alternatives (mode compact, cartes)
- [ ] Améliorer responsive design

### 3. Nouvelles Fonctionnalités (Semaine 5-6)
- [ ] Actions bulk pour lettrage/corrections
- [ ] Exports personnalisables (sélection colonnes, formats)
- [ ] Recherche avancée avec opérateurs
- [ ] Indicateurs de performance (requêtes lentes)

## Architecture Cible

### src/lib/journal/
```
journalService.js      # Logique métier journal
journalFilters.js      # DTOs et validation filtres
journalCalculations.js # Calculs totaux, équilibre
journalExports.js      # Logique exports CSV/JSON
```

### src/lib/ledger/
```
ledgerService.js       # Logique métier ledger
ledgerFilters.js       # DTOs et validation filtres
ledgerCalculations.js  # Agrégations par compte
ledgerExports.js       # Logique exports
```

### Composants
- Séparer logique serveur (data fetching) et client (interactivité)
- Utiliser Server Actions pour mutations
- Client Components pour filtres dynamiques

## Tâches Détaillées

### Tâche 1.1 : DTOs et Validation
- Créer schémas Zod pour tous les filtres
- Valider paramètres côté serveur
- Sanitiser entrées utilisateur

### Tâche 1.2 : Services Métier
- Extraire requêtes Prisma complexes
- Centraliser logique de calcul
- Ajouter cache si nécessaire

### Tâche 2.1 : UX - Tri Dynamique
- État React pour tri colonnes
- Tri local côté client
- Indicateurs visuels (flèches)

### Tâche 2.2 : UX - Filtres Avancés
- Composants filtres réutilisables
- Multi-select pour statuts
- Range sliders pour montants/dates

### Tâche 3.1 : Actions Bulk
- Sélection multiple lignes
- Actions groupées (lettrage, corrections)
- Feedback progressif

## Critères de Succès
- ✅ Performance : Temps de réponse < 500ms pour pages typiques
- ✅ Maintenabilité : Logique séparée, tests unitaires possibles
- ✅ UX : Filtres intuitifs, tri fluide, actions bulk
- ✅ Fiabilité : Validation robuste, gestion erreurs

## Tests
- Tests unitaires pour services métier
- Tests d'intégration pour APIs
- Tests E2E pour parcours utilisateur critiques

## Métriques
- Temps de chargement pages
- Nombre d'erreurs utilisateur
- Satisfaction UX (feedback utilisateur)</content>
<parameter name="filePath">phase-1.3b-02-plan.md