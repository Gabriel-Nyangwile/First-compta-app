# Guide opératoire - Ventes

Ce guide explique le parcours réel du module **Ventes** avec le vocabulaire métier vu à l'écran.

Il répond surtout à la question que se pose l'utilisateur : **par où commencer, puis quelle est l'étape suivante ?**

## 1. Logique générale du flux

Le parcours conseillé est le suivant :

1. créer ou choisir le **client**
2. saisir la **commande client**
3. **confirmer** la commande
4. créer la **sortie de stock / expédition**
5. **confirmer puis poster** la sortie de stock
6. créer la **facture client**
7. enregistrer l'**encaissement** en trésorerie

En termes de références visibles :

| Étape | Référence créée | Signification |
| --- | --- | --- |
| Commande client | `SOxxxxxx` | bon de commande client |
| Sortie de stock | `SWxxxxxx` | expédition / livraison |
| Facture client | `INV-...` | facture de vente |

## 2. Vocabulaire utilisateur

| Terme affiché | Sens métier |
| --- | --- |
| **Client** | tiers acheteur |
| **Commande client** | engagement commercial avant livraison |
| **Confirmer la commande** | rendre la commande exécutable |
| **Expédition client** | sortie de stock liée à une commande |
| **Sortie de stock SW** | document de livraison / préparation expédiée |
| **Poster la sortie** | validation finale de la sortie de stock et du mouvement de stock |
| **Créer la facture** | transformation des quantités expédiées en facture |
| **Compte client 411** | compte de créance du client |
| **Compte de vente 70x** | compte de produit porté sur la ligne de commande / facture |

## 3. Par où commencer

### Cas 1 - Le client existe déjà

Vous pouvez commencer directement par **Commandes clients**.

### Cas 2 - Le client n'existe pas encore

Commencer par **Clients** puis créer la fiche du client.

### Faut-il obligatoirement associer un compte au client ?

Réponse pratique :

- **non** pour créer simplement la fiche client
- **oui en pratique** avant la **facturation comptable** et avant les **encaissements**

Le compte client `411` est donc **optionnel à la création**, mais il devient **nécessaire pour aller jusqu'au bout du cycle vente**.

## 4. Étape 1 - Créer le client

### Où aller

- menu **Ventes**
- écran **Clients**
- bouton **Ajouter un client**

### Données minimales

| Champ | Recommandation |
| --- | --- |
| Nom | obligatoire |
| Email | facultatif |
| Adresse | facultatif |
| Catégorie de paiement | comptant, 15 jours, 30 jours, 45 jours |
| Compte client 411 | recommandé si le client doit être facturé rapidement |

### Bon usage

Si vous savez déjà que le client sera facturé dans le système, associez tout de suite son **compte client 411**.

## 5. Étape 2 - Saisir la commande client

### Où aller

- menu **Ventes**
- **Commandes clients**
- **Nouvelle commande client**

### Ce qu'il faut saisir

| Zone | Attendu |
| --- | --- |
| Client | client concerné |
| Date commande | date de la commande |
| Date livraison prévue | date prévisionnelle |
| Référence client | référence du client si elle existe |
| Produit | article commandé |
| Quantité | quantité demandée |
| PU | prix unitaire |
| TVA | taux de TVA |
| Compte de vente | compte `70x` |

### Point important sur le compte de vente

Chaque ligne de commande doit porter un **compte de vente**.

Le sélecteur de compte affiche maintenant :

- le **numéro du compte**
- puis le **libellé complet**

Si le libellé est long, il passe à la ligne dans la liste de sélection pour rester lisible.

### Résultat après enregistrement

- la commande reçoit une référence `SOxxxxxx`
- son statut est **DRAFT**
- elle n'est pas encore expédiable tant qu'elle n'est pas confirmée

## 6. Étape 3 - Confirmer la commande client

### Où aller

- ouvrir la commande `SOxxxxxx`

### Action à faire

- cliquer sur **Confirmer**

### Résultat

- le statut passe de **DRAFT** à **CONFIRMED**
- la commande devient éligible à l'expédition

### Lecture métier

Une commande **DRAFT** est encore un brouillon.

Une commande **CONFIRMED** est prête pour la préparation / expédition.

## 7. Étape 4 - Créer l'expédition client

### Où aller

Le bon accès est maintenant :

- menu **Ventes**
- **Expéditions clients**

ou bien directement depuis la fiche commande avec le bouton :

- **Créer une expédition**

### Pourquoi cette étape est indispensable

La facture ne doit pas être créée à partir de simples quantités commandées.

La facture doit porter sur des quantités **réellement expédiées**.

### Ce que fait l'utilisateur

1. sélectionner la commande client
2. sélectionner les lignes de commande à expédier
3. saisir ou contrôler les quantités
4. enregistrer la sortie `SWxxxxxx`

### Résultat après création

- une sortie `SWxxxxxx` est créée
- son statut initial est **DRAFT**

## 8. Étape 5 - Confirmer puis poster la sortie de stock

Cette étape est souvent la plus mal comprise.

### 8.1 Confirmer la sortie

La confirmation réserve / prépare la sortie.

### 8.2 Poster la sortie

Le **posting** valide définitivement le mouvement de stock.

C'est seulement après ce posting que les quantités sont considérées comme **expédiées** pour la facturation.

### Règle métier à retenir

| Statut SW | Effet métier |
| --- | --- |
| `DRAFT` | brouillon |
| `CONFIRMED` | préparée mais pas encore expédiée définitivement |
| `POSTED` | expédition validée, quantité facturable |

## 9. Étape 6 - Créer la facture client

### Où aller

- menu **Ventes**
- **Créer facture**

ou depuis la commande avec le bouton :

- **Créer la facture**

### Ce que fait maintenant l'écran

L'écran de facture :

- exige un **bon de commande client**
- reprend les lignes du bon de commande
- contrôle les **sorties de stock liées**
- ne facture que les quantités **expédiées / postées**

### Règle importante

On ne facture pas :

- une commande non confirmée
- une quantité non expédiée
- une sortie SW encore non postée

## 10. Pourquoi un message d'erreur `400` peut apparaître

Le message `400` apparaissait typiquement quand l'utilisateur essayait de facturer trop tôt.

Les causes métier sont généralement :

| Cause | Explication |
| --- | --- |
| commande non confirmée | la commande est encore en brouillon |
| aucune sortie SW liée | aucune expédition n'a été créée |
| sortie SW non postée | la livraison n'est pas encore validée définitivement |
| ligne non liée à la commande | ligne incohérente |
| client sans compte 411 | la créance client ne peut pas être comptabilisée |

### Traduction simple pour l'utilisateur

Si la facture bloque, vérifier dans cet ordre :

1. la commande est-elle **CONFIRMED** ?
2. une sortie `SW` existe-t-elle ?
3. cette sortie `SW` est-elle **POSTED** ?
4. le client a-t-il un **compte 411** ?

## 11. Étape 7 - Encaisser la facture

Une fois la facture créée, le règlement se fait dans le module **Trésorerie**.

Parcours :

1. ouvrir **Trésorerie**
2. choisir **Encaissement client**
3. rechercher la facture
4. saisir ou confirmer le montant encaissé

## 12. Repères de navigation à retenir

### Si vous êtes sur une commande client

- si statut `DRAFT` : **Confirmer**
- si statut `CONFIRMED` et non expédiée : **Créer une expédition**
- si quantités expédiées : **Créer la facture**

### Si vous êtes sur l'écran facture

- si rien n'est facturable : revenir à l'étape **Expéditions clients**
- si la commande n'est pas confirmée : revenir à la fiche **Commande client**

## 13. Check-list terrain

Avant de dire qu'une vente est complète, vérifier :

1. le client existe
2. le client a un **compte 411** si la facture doit être comptabilisée
3. la commande `SO` est **CONFIRMED**
4. la sortie `SW` est **POSTED**
5. la facture a bien été créée
6. l'encaissement a bien été saisi

## 14. Séquence courte à mémoriser

La règle simple à retenir est :

`Client -> SO -> confirmer -> SW -> confirmer/poster -> facture -> encaissement`

## 15. Références techniques

| Élément | Fichier |
| --- | --- |
| Création commande client | [src/app/sales-orders/create/page.jsx](../src/app/sales-orders/create/page.jsx) |
| Détail commande client | [src/app/sales-orders/[id]/page.jsx](../src/app/sales-orders/[id]/page.jsx) |
| API commandes clients | [src/app/api/sales-orders/route.js](../src/app/api/sales-orders/route.js) |
| API détail commande client | [src/app/api/sales-orders/[id]/route.js](../src/app/api/sales-orders/[id]/route.js) |
| Formulaire sortie de stock | [src/components/stockWithdrawals/StockWithdrawalForm.jsx](../src/components/stockWithdrawals/StockWithdrawalForm.jsx) |
| Liste sorties de stock | [src/components/stockWithdrawals/StockWithdrawalList.jsx](../src/components/stockWithdrawals/StockWithdrawalList.jsx) |
| Création facture client | [src/app/invoices/create/page.jsx](../src/app/invoices/create/page.jsx) |
| API factures client | [src/app/api/invoices/route.js](../src/app/api/invoices/route.js) |
| Navigation latérale | [src/components/sidebar/AuthSidebar.jsx](../src/components/sidebar/AuthSidebar.jsx) |
