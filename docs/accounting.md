# Documentation Comptable

Cette documentation décrit la logique comptable actuellement implémentée dans l'application.

## 1. Modèles Principaux

### Invoice

Représente une facture émise à un client. Champs clés:

- `totalAmountHt` : total hors taxes
- `vat` : taux de TVA (ex: 0.2)
- `vatAmount` : montant TVA calculé
- `totalAmount` : total TTC (HT + TVA)
- `status` : `PENDING` ou `PAID`

### Transaction

Représente une écriture comptable élémentaire. Champs clés:

- `amount` : montant (Décimal)
- `direction` : `DEBIT` ou `CREDIT`
- `kind` : type fonctionnel (`RECEIVABLE`, `SALE`, `VAT_COLLECTED`, `PAYMENT`)
- Relations: `account`, `invoice`, `client`

Enums utilisés:

- `TransactionDirection` (DEBIT / CREDIT)
- `TransactionKind` (RECEIVABLE, SALE, VAT_COLLECTED, PAYMENT)

## 2. Flux: Création d'une Facture

Lors de l'appel `POST /api/invoices` la logique suivante est effectuée:

1. Calcul des totaux (HT, TVA, TTC).
2. Création de la facture + lignes.
3. Génération des écritures comptables (double écriture + TVA):
   - Débit compte client (compte 411 propre au client) pour le TTC (`RECEIVABLE`).
   - Crédit comptes de ventes (agrégés par compte sur les lignes) pour le HT (`SALE`).
   - Crédit compte TVA collectée (445700) pour le montant TVA (`VAT_COLLECTED`).

Équilibre: `Débits = Crédit ventes + Crédit TVA` (TTC = HT + TVA).

## 3. Comptes Systèmes

- Compte client: `client.accountId` (créé à la création du client).
- Compte TVA collectée: 445700 (créé automatiquement si absent).
- Comptes de produits: ceux spécifiés par ligne de facture (sélection via autocomplete).

## 4. Flux: Règlement d'une Facture

Route: `POST /api/invoices/[id]/settle`

Entrée JSON:

```json
{ "amount": 100.00, "bankAccountId": "...", "paymentDate": "2025-09-19" }
```

Traitements:

1. Vérification facture + solde restant.
2. Création de deux transactions miroir:
   - DEBIT compte banque (`PAYMENT`).
   - CREDIT compte client (réduction de créance) (`PAYMENT`).
3. Si total payé >= total TTC => statut facture passé à `PAID`.

## 5. Consultation des Écritures

Route: `GET /api/transactions`

Paramètres disponibles:

- `dateStart`, `dateEnd`
- `clientId`, `invoiceId`
- `direction`, `kind`
- `page`, `pageSize`

Réponse inclut:

- `data` : liste des transactions (avec client, facture, compte)
- `sums.debit` / `sums.credit` : agrégats
- `totalPages`

## 6. Page /transactions

Fonctionnalités:

- Filtres combinés
- Agrégats Débit / Crédit / Solde
- Export CSV (format ;, quoting sécurisé)

## 7. Cohérence Comptable

Actuellement:

- Chaque facture produit une écriture structurée équilibrée.
- Les paiements réduisent la créance.
- TVA collectée isolée sur 445700.

### 7.1 Lettrage des transactions

- Les champs `letterRef`, `letterStatus`, `letteredAmount`, `letteredAt` identifient l'appartenance d'une écriture à un groupe lettré.
- `audit-ledger-lettering.js` contrôle que le statut (UNMATCHED/PARTIAL/MATCHED) reste cohérent avec le montant lettré et le solde restant.
- `backfill-transaction-lettering.js` permet de recalculer ces valeurs (option `--dry` pour simulation, `--fix` pour appliquer).
- `npm run test:ledger-lettering` exécute une vérification automatisée (utilise l'audit) à intégrer dans les checks locaux.

Non encore implémenté:

- Factures fournisseurs (charges + TVA déductible + dette fournisseur)
- Avoirs (notes de crédit)
- Paiements partiels affichés dans UI facture
- Journaux (journal des ventes, banque...) séparés
- Gestion multi-taux TVA ou exonérations

## 8. Extensions Futures Recommandées

| Thème | Description | Priorité |
|-------|-------------|----------|
| Fournisseurs | Ajouter modèle miroir pour achats (débit charges, débit TVA déductible, crédit fournisseur) | Haute |
| Avoirs | Inverser écritures facture / ajuster soldes | Haute |
| Journaux | Tag journal (VENTES, BANQUE, ACHATS) sur Transaction | Moyenne |
| Multi-taux TVA | Par ligne, stocker le taux spécifique | Moyenne |
| Balance âgée | Calcul des créances ou dettes par tranche d'échéance | Moyenne |
| Clôture période | Verrouiller transactions avant date limite | Basse |
| Export FEC | Génération conforme fichier des écritures comptables | Basse |

## 9. Intégration Comptable Stock/Tresorerie

Cette section décrit la feuille de route pour relier les flux stock et trésorerie aux écritures comptables. Les scripts `test-inventory-flow.js` et `audit-stock-withdrawals.js` servent de garde-fous techniques.

### 9.1 Sorties de stock (réquisitions / consommation interne)

- **Déclencheur**: validation d'une sortie (`StockWithdrawal.status === 'POSTED'`).
- **Données utilisées**: lignes de retrait (quantité, coût unitaire moyen via `inventory.js`), compte de charge paramétré sur le produit.
- **Écritures cibles**:
   - Débit compte de charge (classe 6) pour la valorisation sortie (Qté × CUMP).
   - Crédit compte stock (classe 3) correspondant.
- **Points de contrôle**:
   - Utiliser `revalueInventory.js` pour garantir que le coût moyen est à jour avant écriture.
   - Vérifier qu'aucune écriture n'est générée tant que le retrait n'est pas valorisé (script `audit-stock-withdrawals.js`).

### 9.2 Retours fournisseurs

- **Déclencheur**: confirmation d'un retour (`SupplierReturn.status === 'POSTED'`).
- **Écritures cibles**:
   - Débit compte fournisseur (classe 401) pour diminuer la dette.
   - Crédit compte stock pour remettre la valorisation en stock.
   - Ajustements TVA déductible (445660) si la facture est déjà comptabilisée.
- **Pré-requis**: rapprocher retour ↔ facture fournisseur pour déterminer montant TTC et base TVA.

### 9.3 Mouvements de trésorerie associés

- **Paiement fournisseur**: déjà défini dans la section factures fournisseurs (future). Les retours nécessiteront un remboursement ou une note de crédit.
- **Remboursement retour fournisseur**:
   - Débit compte banque (512) lors de la réception du remboursement.
   - Crédit compte fournisseur (401) pour solder la note de crédit.
- **Flux interne**: si le retrait de stock est valorisé en interne sans mouvement financier, aucune écriture de trésorerie n'est ajoutée.

### 9.4 Checklist d'implémentation

- Étendre Prisma pour rattacher chaque `StockMovement` au compte de charge / stock adéquat (via relations produit).
- Introduire `TransactionKind` dédiés (`INVENTORY_CONSUMPTION`, `INVENTORY_RETURN`).
- Produire les `Transaction` dans la même transaction Prisma que la validation métier, puis appeler `finalizeBatchToJournal` pour générer l'écriture équilibrée (`JRN-######`).
- Ajouter tests automatisés (`npm run test-inventory-flow`, nouveau test journal) couvrant :
   - équilibre débit/crédit,
   - usage du CUMP,
   - non duplication d'écritures lors des replays.
- Mettre à jour `audit-stock-withdrawals.js` pour vérifier la présence d'écritures correspondantes.

### 9.5 Risques & Mitigations

- **Décalage coût moyen**: toujours recalculer CUMP avant d'écrire; relancer `revalue-inventory-cump.js` en cas de migration historique.
- **Lettrage banque/fournisseur**: les remboursements doivent utiliser les flux existants de lettrage pour rester cohérents (`audit-ledger-lettering.js`).
- **TVA**: s'appuyer sur `getSystemAccounts()` pour récupérer les comptes TVA adéquats et éviter les doublons.

### 9.6 Factures fournisseurs (préparation)

- **Étapes clés**:
   - Étendre le schéma Prisma (`IncomingInvoice`, `IncomingInvoiceLine`) pour stocker montants HT/TVA/TTC, dates d'échéance, statut (`PENDING`, `PAID`).
   - Lier chaque ligne à un compte de charge et, si pertinent, à un article stock pour alimenter la valorisation.
   - Reprendre `nextSequence` pour générer les références (`PIN-######`).
- **Écritures attendues**:
   - Débit compte de charge (classe 6) et débit TVA déductible (445660) par niveau de taux.
   - Crédit compte fournisseur (401xxx) pour le TTC.
   - Cas stock: déclencher une entrée en stock (débit 3xxx) et passer la charge via la sortie lorsque l'article est consommé.
- **Tests & contrôles**:
   - Nouveau script `test-incoming-invoice-journal.js` (à créer) vérifiant équilibre, comptes TVA et lettrage fournisseur.
   - Audit compagnon `audit-incoming-invoices.js` pour confirmer la concordance facture ↔ journal ↔ paiements.

### 9.7 Roadmap d'implémentation

1. **Phase 1 – Modèle & API**
   - Migration Prisma + seed minimal pour fournisseurs et comptes associés.
   - Routes `POST/GET /api/incoming-invoices` avec calcul des montants et validations TVA.
2. **Phase 2 – Journalisation**
   - Implémenter la génération des `Transaction` (charges + TVA + fournisseurs) avec `finalizeBatchToJournal`.
   - Couvrir les retours fournisseurs pour générer notes de crédit.
3. **Phase 3 – Trésorerie & Lettrage**
   - Étendre `/api/money-movements` pour rattacher paiements fournisseurs, lettrage automatique contre comptes 401.
   - Ajouter vues UI pour soldes fournisseurs et balance âgée simple.
4. **Phase 4 – Stock lié**
   - Synchroniser réceptions d'achats avec valorisation initiale (débit stock / crédit fournisseur).
   - Valider cohérence via `test-inventory-flow` et nouveaux tests d'achat.
5. **Phase 5 – Reporting**
   - Générer exports CSV (achats, TVA déductible), mettre à jour reporting tableau de bord.
   - Ajouter indicateurs (délai paiement moyen, valeur stock).

### 9.8 Indicateurs de suivi

- Taux de concordance inventaire ↔ journal (`audit-stock-withdrawals.js`).
- Nombre de factures fournisseurs sans lettrage et délai moyen de paiement.
- Variation du stock valorisé vs consommé (écart CUMP).
- Taux d'échec des scripts tests (`npm run test-journal-integrity`, `npm run test-inventory-flow`).

### 9.9 Plan d'exécution détaillé

- **Semaine 1 – Préparation**
   - Ateliers métier pour valider nomenclature comptable (fournisseurs, charges, TVA déductible).
   - Nettoyage des données legacy: exécuter `audit-party-ids.js`, `audit-stock.js`, produire plan de correction.
   - Rédiger spécifications API/UI en se basant sur `/docs/accounting.md` et `smoke` scripts existants.
- **Semaine 2 – Modèle & API**
   - Migration Prisma, seeds de fournisseurs, endpoints CRUD basiques.
   - Mise en place de validations côté client (App Router) et tests e2e minimal sur nouvelles routes.
- **Semaine 3 – Journal & Tests**
   - Génération des écritures double entrée, création du script `test-incoming-invoice-journal.js`.
   - Ajustement des audits (`audit-incoming-invoices.js`, `audit-ledger-lettering.js`).
- **Semaine 4 – UI & Trésorerie**
   - Pages Next.js pour saisie facture fournisseur, suivi paiements, retours.
   - Intégration avec `money movements` et lettrage.
- **Semaine 5 – Stock & Revue**
   - Synchronisation réceptions ↔ inventaire, exécution de `test-inventory-flow.js` et `audit-stock-withdrawals.js`.
   - Revue générale (tech + métier), préparation note de livraison.

### 9.10 Impacts techniques transverses

- **Sécurité & Permissions**: étendre middleware d'authentification pour inclure rôles (achats/compta).
- **Performance**: prévoir pagination sur `/api/incoming-invoices`, index PostgreSQL sur `dueDate`, `supplierId`.
- **CI/CD**: ajouter nouveaux scripts (`npm run test:incoming-invoice`, `npm run audit:incoming-invoices`) dans pipeline.
- **Observabilité**: logguer les batchs d'écritures via `journal.js` (ID `JRN-######`) pour faciliter traçabilité.
- **Documentation**: mettre à jour `README.fr.md` avec procédures d'exploitation (tests, audits, migrations).

### 9.11 Phase 1 – Checklist opérationnelle

1. **Ateliers & cadrage**
   - Valider avec l'équipe comptable la structure des comptes fournisseurs, charges, TVA déductible.
   - Lister les cas particuliers (factures en devise, remises, avoirs anticipés) pour les traiter dans la conception.
2. **Audit des données existantes**
   - Exécuter `node scripts/audit-party-ids.js --suppliers` et consigner les anomalies.
   - Lancer `node scripts/audit-stock.js` pour vérifier cohérence inventaire avant d'ajouter les flux fournisseurs.
   - Produire un rapport synthétique (`docs/phase1-audit-YYYYMMDD.md` à créer) avec plan de remédiation.
3. **Design technique**
   - Esquisser le schéma Prisma cible (`prisma/schema.prisma` brouillon) avec tables `IncomingInvoice`, `IncomingInvoiceLine`, `Supplier` enrichi.
   - Rédiger une RFC courte (`docs/rfc-incoming-invoices.md`) couvrant API, validations, dépendances.
4. **Préparation migrations**
   - Définir la stratégie de rétrofit des données (seed minimal, import existant via `scripts/import-accounts.js`).
   - Planifier la migration `npx prisma migrate dev -n "incoming-invoices-phase1"` et tests associés.
5. **Organisation & backlog**
   - Créer cartes/US dans l'outil de suivi (Phase 1) avec définition of done claire (docs, tests, scripts).
   - Bloquer une revue intermédiaire fin de semaine pour valider readiness Phase 2.

### 9.12 Phase 2 – Préparation journalisation

1. **Migration Prisma**
   - Mettre à jour `prisma/schema.prisma` avec les modèles validés en Phase 1.
   - Générer migration `npx prisma migrate dev -n "incoming-invoices-phase2"` et pousser sur base locale.
   - Exécuter `npm run lint` et `npm run test` pour détecter régressions liées au schéma.
2. **Services & Repository**
   - Créer `src/lib/incomingInvoices/service.js` gérant création, calcul TVA multiple, statuts.
   - Ajouter `src/lib/journal/incomingInvoicePosting.js` encapsulant les écritures (charges, TVA, fournisseur).
   - Couvrir les conversions Decimal → Number via helpers existants (`value?.toNumber?.() ?? 0`).
3. **API**
   - Implémenter routes App Router :
     - `POST /api/incoming-invoices` (création + journalisation dans transaction Prisma).
     - `GET /api/incoming-invoices` (listing paginé, filtres supplier/dueDate/status).
     - `POST /api/incoming-invoices/[id]/post` pour verrouiller et générer `JournalEntry`.
   - Ajouter tests API (`src/app/api/incoming-invoices/route.test.js` ou équivalent) via `jest`/`vitest`.
4. **Journal & Scripts**
   - Utiliser `finalizeBatchToJournal` pour produire `JRN-######`.
   - Créer script `scripts/test-incoming-invoice-journal.js` avec assertions sur équilibre, comptes TVA, lettrage 401.
   - Mettre à jour `scripts/audit-incoming-invoices.js` (nouveau) pour vérifier cohérence facture ↔ journal.
5. **Qualité & Revues**
   - Lancer `npm run test-inventory-flow` et `npm run test-journal-integrity` après intégration.
   - Préparer documentation technique (`docs/rfc-incoming-invoices.md` annexe B) avec exemples d'écritures.

### 9.13 Phase 3 – Trésorerie & Lettrage

1. **Money Movements**
   - Étendre le modèle `MoneyMovement` pour inclure `supplierId`, `incomingInvoiceId`, `voucherRef` généré via `nextSequence(prisma, 'moneyMovement', 'MMV-')`.
   - Mettre à jour `src/app/api/money-movements/route.js` pour supporter paiements fournisseurs (création, listing filtré).
   - Implémenter logique de lettrage automatique (mise à jour `Transaction.letterRef`, `letterStatus`).
2. **UI & Expérience utilisateur**
   - Ajouter pages App Router `app/(dashboard)/treasury/suppliers/page.jsx` et modales pour saisir paiements.
   - Prévoir feedback sur le solde restant de chaque facture (composant réutilisable dans la fiche fournisseur).
   - Voir section 9.13.1 pour l’interface de lettrage client-side (bannière de confirmation + auto-refresh des données de trésorerie).
3. **Scripts & Audits**
   - Nouveau script `scripts/test-money-movement-supplier.js` pour couvrir paiements, annulations, lettrage.
   - Mettre à jour `scripts/audit-money-movements.js` pour inclure contrôles fournisseurs (solde 401 aligné).
4. **Rapprochements bancaires**
   - Adapter le flux d'import `bankAdvice` pour catégoriser les mouvements fournisseurs et suggérer un lettrage.
   - Introduire un statut `clearedAt` quand le paiement est rapproché, avec reporting dans le tableau de bord.
5. **Qualité**
   - Tests automatisés : `npm run test-money-movement`, `npm run test:incoming-invoice`.
   - Revue croisée entre équipe compta et équipe produit pour valider UX paiement fournisseur.

---

Dernière mise à jour : 2025-10-13

### 9.13.1 Interface Trésorerie Fournisseur

- **Lettrage côté UI** : le composant `LetteringPanel` déclenche le match via l’API `/api/suppliers/[id]/lettering/match`, puis affiche une bannière dismissible résumant la réussite (référence lettrage, nombre d’écritures mises à jour) ou l’échec. Les totaux (payable/paiements/delta) sont recalculés immédiatement.
- **Historique** : `SupplierTreasuryPanel` consomme `/api/suppliers/[id]/treasury`, affiche les factures ouvertes, les paiements récents et un bloc “Dernières actions” (5 derniers lettrages/paiements). La timeline inclut désormais `voucherRef`, statut et outstanding normalisé.
- **Rafraîchissement** : les données trésorerie sont rechargées toutes les 15 s et via le bouton “Actualiser” (timestamp affiché). Utile pour suivre plusieurs lettrages successifs sans F5.
- **Scripts de contrôle** : après toute évolution UI/API, exécuter `npm run test:money-movement` et `npm run test:ledger-lettering` pour vérifier équilibre et lettrage.

### 9.14 Inventaires physiques & ajustements

- **Structure de données** : tables `InventoryCount` (en-tête) et `InventoryCountLine` (détail) stockent l’instantané (`snapshotQty/Avg`) et la quantité comptée. Statuts : `DRAFT` ➝ `COMPLETED` ➝ `POSTED` (ou `CANCELLED`).
- **API** :
  - `POST /api/inventory-counts` crée un inventaire (sélection optionnelle de produits, date prévue, note, auteur).
  - `GET /api/inventory-counts` filtre par statut.
  - `PUT /api/inventory-counts/[id]` avec `action=UPDATE_LINE|COMPLETE|POST|CANCEL` pour renseigner les comptages, verrouiller ou générer les écarts.
- **Traitement des écarts** : lors du `POST`, chaque ligne calcule `deltaQty = counted - snapshot` et déclenche un mouvement `StockMovement` (`movementType=ADJUST`, `inventoryCountLineId`). Le CUMP est recalculé via `applyAdjustMovement`.
- **Écritures comptables** :
  - Débit/crédit du compte d’actif (`Product.inventoryAccountId`, classe 31/32) pour la valeur absolue de l’écart.
  - Contrepartie sur le compte de variation (`Product.stockVariationAccountId`) : débit (603) si perte, crédit (730) si gain. La journalisation est réalisée via `finalizeBatchToJournal` (source `OTHER`).
  - Les comptes 68/78 peuvent être ajoutés en aval si la politique prévoit un reclassement, le code laisse la possibilité d’étendre le batch.
- **Suivi & audits** :
  - `node scripts/revalue-inventory-cump.js` recalcule le stock théorique et actualise `ProductInventory` avant/ après campagnes.
  - `node scripts/audit-stock.js` confirme l’alignement mouvements ↔ inventaire (tolérance 1e-3).
  - Les lignes d’inventaire conservent les références (mouvement, journal) pour traçabilité.
- **Reporting** : `/api/inventory-counts/summary` (indicateurs agrégés) et `/api/inventory-counts/export` (CSV complet) – protégés par `ADMIN_TOKEN`.
- **UI** : menu *Inventaires* (synthèse) puis *Ajustements stock* pour le formulaire. Ce dernier affiche stock théorique/CUMP, calcule l’écart et propose deux actions de navigation (`Annuler`, `Retour`).
- **Notifications & sécurité** : définir `ADMIN_TOKEN` pour sécuriser les requêtes POST/PUT et `SLACK_WEBHOOK_URL` pour recevoir une alerte (Slack) lors du passage de l'inventaire à `COMPLETED` ou `POSTED`.

### 9.14.1 Audit inventaires

- Script : `node scripts/audit-inventory-count.js [--include-draft]`.
- Contrôles :
  - lignes sans quantité comptée lorsque le statut n’est plus DRAFT ;
  - écarts de quantité/valeur incohérents par rapport aux deltas stockés ;
  - mouvements `StockMovement` manquants ou incohérents (quantité, costes) ;
  - produits dépourvus de comptes inventaire/variation ;
  - stock courant très éloigné du snapshot + delta estimé.
- Retour console : ✅ aucun écart ou ⚠️ inventaire/ligne concerné(e). Exit code 1 si anomalies.

## 10. Glossaire

- **Créance**: Montant dû par un client (compte 411).
- **TVA collectée**: TVA facturée aux clients (compte 4457xx).
- **Double écriture**: Principe comptable garantissant l'équilibre Débits = Crédits.
- **Solde**: Différence cumulée Débits - Crédits dans une vue donnée.

## 11. Points de Vigilance

- Validation: s'assurer que chaque ligne a un compte.
- Règlement: empêcher montants supérieurs au solde restant.
- Concurrence: envisager un verrouillage optimiste (version ou transaction unique) pour paiements simultanés.
- Performance: pagination déjà mise en place; prévoir index sur (date, clientId, invoiceId, kind).

## 12. Index Recommandés (PostgreSQL)

À ajouter si le volume grandit:

```sql
CREATE INDEX IF NOT EXISTS idx_transaction_date ON "Transaction"("date");
CREATE INDEX IF NOT EXISTS idx_transaction_client ON "Transaction"("clientId");
CREATE INDEX IF NOT EXISTS idx_transaction_invoice ON "Transaction"("invoiceId");
CREATE INDEX IF NOT EXISTS idx_transaction_kind ON "Transaction"("kind");
```

## 13. Résumé

Le socle mis en place couvre l'émission, la comptabilisation et le règlement des factures clients avec traçabilité des écritures et export. Les prochaines étapes majeures concernent les achats (fournisseurs) et la gestion des avoirs.

---
## Annexe B. Commandes Utiles


```bash
# Lancer le serveur de dev
npm run dev

# Appliquer migrations & générer client Prisma
npx prisma migrate dev

# Voir le studio Prisma (exploration données)
npx prisma studio

# Importer le plan comptable (CSV -> Accounts)
node scripts/import-accounts.js

# Re-générer le client sans migration
npx prisma generate

# Vérifier la cohérence du lettrage
npm run test:ledger-lettering

# Audit manuel du lettrage (détails JSON)
node scripts/audit-ledger-lettering.js

# Backfill lettrage (ajouter --dry pour simulation)
node scripts/backfill-transaction-lettering.js --fix
```

## Annexe A. Exemples

### A.1 Facture de vente simple

Facture : 2 lignes

| Ligne | Compte produit | Libellé | Qté | PU HT | Montant HT |
|-------|----------------|---------|-----|-------|------------|
| 1     | 706100         | Prestation A | 1   | 60.00 | 60.00 |
| 2     | 706200         | Prestation B | 1   | 40.00 | 40.00 |

Total HT = 100.00 €  
TVA (20%) = 20.00 €  
Total TTC = 120.00 €

Écritures générées :

| Date | Compte  | Libellé                       | Débit  | Crédit | Direction | Kind          |
|------|---------|-------------------------------|--------|--------|-----------|---------------|
| J    | 411xxx  | Facture CLIENT F2025-0001     | 120.00 |        | DEBIT     | RECEIVABLE    |
| J    | 706100  | Ventes Prestation A           |        | 60.00  | CREDIT    | SALE          |
| J    | 706200  | Ventes Prestation B           |        | 40.00  | CREDIT    | SALE          |
| J    | 445700  | TVA collectée 20%             |        | 20.00  | CREDIT    | VAT_COLLECTED |

Contrôle : Total débits (120) = Total crédits (60+40+20 = 120).

### A.2 Paiement partiel puis solde

Paiement 1 : 70.00 € (virement)  
Paiement 2 : 50.00 € (virement) => total payé 120.00 €, facture soldée.

Écritures paiement 1 :

| Date | Compte | Libellé              | Débit | Crédit | Direction | Kind    |
|------|--------|----------------------|-------|--------|-----------|---------|
| J+10 | 512xxx | Règlement partiel    | 70.00 |        | DEBIT     | PAYMENT |
| J+10 | 411xxx | Règlement partiel    |       | 70.00  | CREDIT    | PAYMENT |

Solde créance restant après paiement 1 : 120 - 70 = 50 €.

Écritures paiement 2 :

| Date | Compte | Libellé              | Débit | Crédit | Direction | Kind    |
|------|--------|----------------------|-------|--------|-----------|---------|
| J+30 | 512xxx | Règlement solde      | 50.00 |        | DEBIT     | PAYMENT |
| J+30 | 411xxx | Règlement solde      |       | 50.00  | CREDIT    | PAYMENT |

Facture marquée `PAID`.

---

Dernière mise à jour : 2025-10-11

