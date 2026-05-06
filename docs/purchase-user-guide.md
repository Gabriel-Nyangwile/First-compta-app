# Guide opératoire - Achats

Ce guide couvre le cycle d'achat standard, depuis le bon de commande fournisseur jusqu'à la réception de la facture fournisseur.

## 1. Périmètre audité

Le module couvre les objets suivants :

| Objet | Écran principal | Rôle dans le flux |
| --- | --- | --- |
| Bons de commande | `/purchase-orders` | création, approbation, suivi des quantités commandées/reçues/facturées |
| Réceptions | `/goods-receipts` | enregistrement des livraisons, contrôle qualité, rangement en stock |
| Retours fournisseurs | `/return-orders` | retour de quantités déjà rangées |
| Factures fournisseurs reçues | `/incoming-invoices` | comptabilisation de la facture, TVA déductible, dette fournisseur, paiement |
| Fournisseurs | `/suppliers` | tiers fournisseur et compte 401 associé |

Le parcours nominal audité est :

1. créer un fournisseur avec un compte fournisseur
2. créer les produits achetés avec leurs comptes de stock
3. créer un bon de commande
4. approuver le bon de commande
5. réceptionner les articles livrés
6. valider le contrôle qualité
7. ranger les articles en stock
8. saisir la facture fournisseur liée au bon reçu
9. régler la facture ou la laisser en dette fournisseur

## 2. Pré-requis

Avant de créer un bon de commande, vérifier :

| Élément | Condition attendue |
| --- | --- |
| Fournisseur | fiche fournisseur existante |
| Compte fournisseur | compte `401` renseigné sur le fournisseur avant facturation |
| Produits | produits existants dans le catalogue |
| Comptes de stock produit | compte inventaire et compte variation de stock renseignés pour la mise en stock |
| Comptes de charge | compte `6xx` disponible pour chaque ligne de facture fournisseur |
| Droits utilisateur | droits achats adaptés au rôle courant |

Les permissions utilisées par le module sont notamment :

| Action | Permission |
| --- | --- |
| Créer un bon de commande | `createPurchaseOrder` |
| Approuver ou clôturer un bon | `approvePurchaseOrder` |
| Réceptionner | `receivePurchaseOrder` |
| Créer une facture fournisseur | `createIncomingInvoice` |
| Gérer une facture fournisseur | `approveIncomingInvoice` |
| Régler une facture | `createPayment` ou `approvePayment` |

## 3. Statuts du bon de commande

| Statut | Signification utilisateur |
| --- | --- |
| `DRAFT` | bon créé, non encore approuvé |
| `APPROVED` | bon validé, réception possible |
| `STAGED` | réception créée, mais QC ou rangement non terminé |
| `PARTIAL` | une partie des quantités a été reçue et rangée |
| `RECEIVED` | toutes les lignes sont reçues et traitées |
| `CLOSED` | bon clôturé |
| `CANCELLED` | bon annulé avant réception |

Une facture fournisseur liée à un bon de commande n'est acceptée que si le bon est en statut `RECEIVED` ou `CLOSED`.

## 4. Créer un bon de commande

Aller dans :

```text
Achats > Bons de commande > Nouveau bon de commande
```

Renseigner :

- fournisseur
- date attendue
- devise
- lignes de produits
- quantité commandée
- prix unitaire
- taux de TVA éventuel
- notes internes éventuelles

Après validation, le bon est créé avec un numéro automatique `PO-...` et le statut `DRAFT`.

À ce stade :

- aucune réception n'est possible depuis les écrans de réception filtrés
- aucune facture fournisseur liée ne peut être créée
- aucune écriture comptable n'est générée

## 5. Approuver le bon

Ouvrir la fiche du bon :

```text
/purchase-orders/[id]
```

Cliquer sur :

```text
Approuver
```

Le statut passe de `DRAFT` à `APPROVED`.

Le bon devient disponible pour la réception. L'historique des statuts conserve la transition.

## 6. Réceptionner les marchandises

Depuis la fiche du bon, utiliser :

```text
Créer une réception dédiée
```

ou aller directement dans :

```text
Achats > Réceptions > Nouvelle réception
```

Sélectionner le bon de commande, puis renseigner pour chaque ligne :

- quantité réellement reçue
- coût unitaire

Le système bloque les quantités reçues au-delà de la quantité commandée, sauf tolérance configurée via `PO_OVER_RECEIPT_TOLERANCE_PCT`.

Après création de la réception :

- les quantités entrent en stock au stade `STAGED`
- un mouvement de stock est créé
- la ligne de bon de commande voit sa quantité reçue augmenter
- le bon passe généralement en `STAGED` tant que la réception n'est pas traitée

## 7. Contrôle qualité

Ouvrir la réception :

```text
/goods-receipts/[id]
```

Pour chaque ligne en attente :

| Action | Effet |
| --- | --- |
| Valider QC | la ligne passe en attente de rangement si elle n'est pas encore rangée |
| Rejeter | la quantité rejetée est retirée du stock `STAGED` |

Un rejet réduit aussi la quantité reçue sur la ligne du bon de commande.

## 8. Rangement en stock

Après validation QC, cliquer sur :

```text
Ranger
```

Renseigner :

- quantité à ranger
- coût unitaire si différent
- emplacement de stockage optionnel

Le rangement :

- transfère la quantité de `STAGED` vers `AVAILABLE`
- crée les mouvements de stock correspondants
- débite le compte de stock du produit
- crédite le compte de variation de stock du produit
- génère une écriture de journal équilibrée de type `GOODS_RECEIPT`

Quand toutes les lignes sont traitées, la réception passe en `PUTAWAY_DONE`.

Si toutes les quantités du bon sont reçues et traitées, le bon passe en `RECEIVED`.

## 9. Gérer une réception partielle

Une livraison partielle laisse le bon en `PARTIAL` après QC et rangement.

Pour compléter :

1. revenir sur la fiche du bon
2. consulter le bloc "Restant à recevoir"
3. créer une nouvelle réception sur les lignes restantes
4. traiter QC et rangement comme pour la première réception

La facture fournisseur liée au bon reste bloquée tant que le bon n'est pas `RECEIVED` ou `CLOSED`.

## 10. Créer un retour fournisseur

Un retour fournisseur est possible uniquement sur les quantités déjà rangées et encore disponibles au retour.

Depuis une réception traitée :

```text
Créer un retour fournisseur
```

Renseigner :

- quantité retournée
- coût unitaire
- motif de ligne ou motif global
- notes internes éventuelles

Le retour :

- sort la quantité disponible
- met à jour la quantité retournée sur la ligne du bon
- recalcule le statut du bon si nécessaire
- génère les écritures de retour fournisseur prévues par le module

## 11. Saisir la facture fournisseur

Aller dans :

```text
Achats > Factures fournisseurs reçues > Nouvelle facture reçue
```

Renseigner :

- fournisseur
- bon de commande, si la facture concerne un bon reçu
- numéro de facture fournisseur
- taux de TVA global
- date de réception
- date d'émission
- date d'échéance
- lignes de facture
- compte de charge `6xx` pour chaque ligne

Si un fournisseur est sélectionné, seuls les bons de commande de ce fournisseur en `RECEIVED` ou `CLOSED` sont proposés.

Quand un bon est sélectionné, les lignes peuvent être préremplies depuis le bon. Le compte de charge reste à renseigner manuellement.

À l'enregistrement, le système :

- génère un numéro interne `EI-YYYY-0001`
- crée les lignes de facture fournisseur
- débite les comptes de charge sélectionnés
- débite la TVA déductible si applicable
- crédite le compte fournisseur `401`
- génère une écriture de journal équilibrée de type `INCOMING_INVOICE`
- met à jour les quantités facturées du bon de commande

## 12. Consulter et payer les factures fournisseurs

Aller dans :

```text
Achats > Factures fournisseurs reçues
```

La liste affiche :

- numéro interne
- numéro fournisseur
- bon de commande lié
- fournisseur
- date de réception
- total TTC
- montant payé
- solde restant
- statut
- dernière pièce de trésorerie

Actions disponibles :

| Action | Usage |
| --- | --- |
| Modifier | corriger une facture non payée et sans paiement |
| Régler | enregistrer un paiement fournisseur |
| Payer restant | ouvrir le flux trésorerie avec la facture préselectionnée |
| PDF | télécharger la facture en PDF |
| Supprimer | supprimer une facture non réglée et sans mouvement lié |

Le paiement fournisseur :

- débite le compte fournisseur
- crédite le compte banque
- crée un mouvement de trésorerie sortant
- génère une écriture de journal
- met à jour le statut de la facture à `PAID` si elle est totalement réglée

## 13. Contrôles automatiques du module

Le module applique les contrôles suivants :

| Contrôle | Comportement |
| --- | --- |
| Bon non approuvé | réception non disponible dans le flux normal |
| Bon non reçu | facture fournisseur liée refusée |
| Fournisseur différent | facture liée refusée si le fournisseur ne correspond pas au bon |
| Quantité réceptionnée excessive | réception refusée hors tolérance |
| Quantité facturée excessive | facture refusée si elle dépasse la quantité commandée |
| Fournisseur sans compte 401 | facture refusée |
| Produit sans comptes de stock | rangement refusé |
| Facture payée | modification et suppression bloquées |

## 14. Points d'audit constatés

Le flux métier principal est cohérent et protégé :

- les bons sont isolés par société
- les créations critiques contrôlent les permissions
- les réceptions alimentent d'abord le stock `STAGED`
- la mise en stock comptabilise l'entrée stock
- la facture fournisseur est bloquée tant que le bon n'est pas reçu
- les écritures de facture sont finalisées dans un journal équilibré
- la page des bons signale les bons reçus sans facture fournisseur

Points à surveiller pour une phase de durcissement :

| Point | Risque | Recommandation |
| --- | --- | --- |
| Numéro interne facture fournisseur | `EI-YYYY-0001` est basé sur un comptage annuel, contrairement aux séquences centralisées | migrer vers `nextSequence` pour éviter les collisions en concurrence |
| Compte de charge facture | le compte `6xx` est demandé manuellement même si la facture vient d'un bon | proposer un compte par défaut selon le produit ou la nature d'achat |
| Réponses API métier | certaines erreurs métier de création facture remontent encore en statut HTTP `500` | retourner `400` ou `409` selon le cas |
| Paiement fournisseur | le règlement direct utilise une référence `MV-${Date.now()}` | aligner sur `nextSequence` pour les références de trésorerie |
| Statut `INVOICED` | présent dans l'enum mais peu utilisé dans le flux observé | clarifier ou retirer son usage fonctionnel lors d'une phase ultérieure |

## 15. Recette recommandée

Contrôles techniques utiles après modification du module :

```bash
npm run test:po-flow
npm run test:po-cancel
npm run test:return-order
npm run audit:stock
npm run ledger:balance
```

Pour un contrôle complet du parcours bon de commande :

```bash
npm run test:po-all
```

Ce test couvre le blocage facture avant réception, la réception partielle, le QC, le rangement, la réception finale, la facture fournisseur et la clôture.
