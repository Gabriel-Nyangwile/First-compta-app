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

## 9. Glossaire

- **Créance**: Montant dû par un client (compte 411).
- **TVA collectée**: TVA facturée aux clients (compte 4457xx).
- **Double écriture**: Principe comptable garantissant l'équilibre Débits = Crédits.
- **Solde**: Différence cumulée Débits - Crédits dans une vue donnée.

## 10. Points de Vigilance

- Validation: s'assurer que chaque ligne a un compte.
- Règlement: empêcher montants supérieurs au solde restant.
- Concurrence: envisager un verrouillage optimiste (version ou transaction unique) pour paiements simultanés.
- Performance: pagination déjà mise en place; prévoir index sur (date, clientId, invoiceId, kind).

## 11. Index Recommandés (PostgreSQL)

À ajouter si le volume grandit:

```sql
CREATE INDEX IF NOT EXISTS idx_transaction_date ON "Transaction"("date");
CREATE INDEX IF NOT EXISTS idx_transaction_client ON "Transaction"("clientId");
CREATE INDEX IF NOT EXISTS idx_transaction_invoice ON "Transaction"("invoiceId");
CREATE INDEX IF NOT EXISTS idx_transaction_kind ON "Transaction"("kind");
```

## 12. Résumé

Le socle mis en place couvre l'émission, la comptabilisation et le règlement des factures clients avec traçabilité des écritures et export. Les prochaines étapes majeures concernent les achats (fournisseurs) et la gestion des avoirs.

---

Dernière mise à jour : 2025-09-19

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
