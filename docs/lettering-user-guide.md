# Guide opératoire - Lettrage transversal

Ce guide explique le **lettrage** de manière pédagogique pour les utilisateurs comptables.

Le lettrage est transversal : on le retrouve dans les clients, les fournisseurs, la trésorerie, le grand livre et la paie. Mais il ne faut pas le comprendre comme un bouton magique qui s'applique à toutes les écritures. Le lettrage sert à **rapprocher une dette ou une créance avec son règlement**.

## 1. Définition simple

Le lettrage répond à une question :

> Cette facture, cette dette ou cette créance a-t-elle été réglée par ce paiement ?

Exemples :

| Cas | Ce qu'on rapproche |
| --- | --- |
| Client | facture client avec encaissement client |
| Fournisseur | facture fournisseur avec paiement fournisseur |
| Paie | dette de paie avec règlement salarié ou organisme |
| Grand livre | lignes comptables liées par une même référence de lettrage |

## 2. Ce que le lettrage n'est pas

Le lettrage n'est pas :

- la création du paiement
- la validation de la facture
- la comptabilisation du journal
- le rapprochement bancaire complet
- la suppression d'une dette

Le paiement doit d'abord exister. Ensuite seulement, le lettrage permet d'indiquer que ce paiement couvre une facture ou un passif.

## 3. Les statuts de lettrage

| Statut | Sens métier |
| --- | --- |
| **UNMATCHED** | non lettré, aucun règlement rapproché |
| **PARTIAL** | partiellement lettré, une partie seulement est rapprochée |
| **MATCHED** | totalement lettré, le règlement couvre le montant attendu |

## 4. Champs techniques visibles

| Champ | Sens |
| --- | --- |
| **letterRef** | référence de groupe de lettrage, ex. `LTR-000001` |
| **letterStatus** | statut `UNMATCHED`, `PARTIAL` ou `MATCHED` |
| **letteredAmount** | montant déjà lettré |
| **letteredAt** | date de lettrage |

Ces champs sont visibles dans le grand livre, les exports et certains écrans de contrôle.

## 5. Pourquoi le lettrage semble parfois ne pas s'exécuter

Le problème actuel principal est fonctionnel :

> Sur les flux clients et fournisseurs, l'action de lettrage disponible sur le paiement marque surtout les écritures du **mouvement de trésorerie**. Elle ne rapproche pas encore de manière complète la **facture d'origine** avec le **paiement** lorsque ces écritures sont dans des groupes séparés.

Conséquence utilisateur :

- le bouton peut répondre **Lettrage effectué**
- une référence `LTR-...` peut être créée
- mais la facture ou la dette peut rester affichée comme non lettrée dans certains tableaux

Ce n'est donc pas seulement un problème de compréhension utilisateur. Il y a une limite d'implémentation à corriger pour obtenir un vrai lettrage facture-paiement.

## 6. Lettrage fournisseur - utilisation actuelle

### Où aller

Deux accès existent :

- **Lettrage fournisseurs**
- fiche fournisseur, bloc **Lettrage / Matching**

### Ce que l'écran affiche

| Zone | Lecture |
| --- | --- |
| **Somme payable** | total des dettes fournisseur détectées |
| **Somme paiements** | total des paiements fournisseur détectés |
| **Delta** | écart entre dette et paiements |
| **Statuts** | nombre d'écritures `UNMATCHED`, `PARTIAL`, `MATCHED` |
| **Facture** | facture fournisseur concernée si disponible |
| **Paiement** | mouvement de trésorerie concerné |
| **Compte** | compte comptable de la ligne |
| **Lettrer** | action disponible sur les lignes de paiement |

### Parcours utilisateur

1. ouvrir le fournisseur
2. repérer un paiement fournisseur
3. cliquer sur **Lettrer**
4. vérifier le message de réussite
5. contrôler le statut de lettrage
6. vérifier le grand livre fournisseur

### Limite actuelle

Le lettrage fournisseur actuel ne garantit pas encore que la facture fournisseur d'origine soit elle-même marquée comme totalement rapprochée. Pour un vrai lettrage métier, il faudra que l'action associe explicitement :

- la ligne dette fournisseur issue de la facture
- la ligne paiement fournisseur issue de la trésorerie

## 7. Lettrage client - utilisation actuelle

### Où aller

Deux accès existent :

- **Lettrage clients**
- fiche client, bloc **Lettrage / Matching**

### Ce que l'écran affiche

| Zone | Lecture |
| --- | --- |
| **Somme créances** | total des créances client |
| **Somme paiements** | total des encaissements |
| **Delta** | reste à encaisser ou écart |
| **Facture** | facture client concernée |
| **Paiement** | mouvement d'encaissement |
| **Lettrer** | action disponible sur les encaissements |

### Parcours utilisateur

1. ouvrir le client
2. repérer l'encaissement
3. cliquer sur **Lettrer**
4. vérifier la référence `LTR-...`
5. contrôler le grand livre client

### Limite actuelle

Comme pour les fournisseurs, l'action actuelle est encore trop centrée sur le mouvement de trésorerie. Le vrai objectif métier doit être :

- facture client `411`
- encaissement client
- même référence de lettrage
- statut `MATCHED` si le montant est totalement couvert
- statut `PARTIAL` si le règlement est partiel

## 8. Lettrage paie

Le lettrage paie est plus proche de l'usage métier attendu.

### Où aller

Dans une période de paie `POSTED`, ouvrir le détail de période.

### Actions disponibles

| Action | Effet |
| --- | --- |
| **Relettrer paie** | tente de rapprocher tous les passifs paie |
| **Lettrer NET_PAY** | rapproche le net salariés |
| **Lettrer CNSS** | rapproche la dette CNSS |
| **Lettrer ONEM** | rapproche la dette ONEM |
| **Lettrer INPP** | rapproche la dette INPP |
| **Lettrer PAYE_TAX** | rapproche l'IPR |

### Règle

Le lettrage paie rapproche :

- les écritures de passif issues du journal de paie
- les écritures de règlement issues des paiements salariés ou organismes

### Lecture

| Statut | Sens |
| --- | --- |
| **UNMATCHED** | dette non réglée |
| **PARTIAL** | dette partiellement réglée |
| **MATCHED** | dette réglée et lettrée |

## 9. Lettrage dans le grand livre

Le grand livre n'est pas seulement un écran de consultation. Il sert à auditer le lettrage.

### Filtres utiles

| Filtre | Utilisation |
| --- | --- |
| **Lettrage = UNMATCHED** | voir les lignes non rapprochées |
| **Lettrage = PARTIAL** | voir les lignes partiellement rapprochées |
| **Lettrage = MATCHED** | voir les lignes soldées |
| **Recherche par LTR-...** | retrouver un groupe de lettrage |

### Colonnes importantes

| Colonne | Lecture |
| --- | --- |
| **Lettrage** | statut de la ligne |
| **Réf lettrage** | groupe auquel appartient la ligne |
| **Lettré** | montant lettré |
| **Reste à lettrer** | solde restant |

## 10. Différence entre paiement, règlement et lettrage

| Terme | Sens |
| --- | --- |
| **Paiement / encaissement** | mouvement d'argent |
| **Règlement** | extinction partielle ou totale d'une dette |
| **Lettrage** | rapprochement comptable entre dette/créance et règlement |

Exemple fournisseur :

1. facture fournisseur : dette créée
2. paiement fournisseur : trésorerie sortie
3. lettrage : la dette et le paiement sont rapprochés

## 11. Quand utiliser le lettrage

Utiliser le lettrage après :

- un paiement fournisseur
- un encaissement client
- un règlement du net salariés
- un règlement CNSS/ONEM/INPP/IPR
- une correction de paiement partiel

Ne pas utiliser le lettrage avant que le paiement existe.

## 12. Contrôles après lettrage

Après lettrage, vérifier :

1. le statut `MATCHED` ou `PARTIAL`
2. la référence `LTR-...`
3. le montant lettré
4. le reste à lettrer
5. le grand livre du tiers ou de la période
6. le tableau de bord si l'alerte reste affichée

## 13. Lecture des cas fréquents

| Situation | Interprétation |
| --- | --- |
| `UNMATCHED` avec paiement existant | le paiement n'est pas encore rapproché ou le lettrage actuel n'a pas relié la bonne dette |
| `PARTIAL` | paiement partiel ou différence de montant |
| `MATCHED` mais facture encore ouverte | incohérence entre statut facture et statut lettrage |
| message `Lettrage impossible` | mouvement non compatible ou non équilibré |
| message `NO_TRANSACTIONS` | le mouvement n'a pas les lignes attendues |
| message `NOT_BALANCED` | les lignes à lettrer ne sont pas équilibrées |
| message `ALREADY_MATCHED` | le mouvement est déjà lettré |

## 14. Règle pédagogique à retenir

Un lettrage correct doit répondre à trois conditions :

1. même tiers ou même passif
2. dette/créance et paiement identifiables
3. montants compatibles

Si l'une de ces trois conditions manque, le lettrage peut échouer ou rester partiel.

## 15. Point d'amélioration à prévoir

Pour rendre le lettrage pleinement opérationnel dans tous les modules, il faut faire évoluer l'implémentation client/fournisseur pour que l'utilisateur puisse choisir explicitement :

- la facture ou dette à lettrer
- le paiement ou encaissement à rapprocher
- le montant à affecter en cas de règlement partiel

La cible fonctionnelle est :

| Cas | Résultat attendu |
| --- | --- |
| facture 100, paiement 100 | `MATCHED`, reste 0 |
| facture 100, paiement 60 | `PARTIAL`, reste 40 |
| facture 100, paiements 60 + 40 | `MATCHED`, reste 0 |
| paiement sans facture | `UNMATCHED` ou avance/acompte |

## 16. Références techniques

| Élément | Fichier |
| --- | --- |
| Lettrage fournisseur UI | [src/components/suppliers/lettering/LetteringPanel.jsx](../src/components/suppliers/lettering/LetteringPanel.jsx) |
| Lettrage client UI | [src/components/clients/lettering/ClientLetteringPanel.jsx](../src/components/clients/lettering/ClientLetteringPanel.jsx) |
| Match fournisseur actuel | [src/lib/lettering/matchSupplierPayment.js](../src/lib/lettering/matchSupplierPayment.js) |
| Match client actuel | [src/lib/lettering/matchClientPayment.js](../src/lib/lettering/matchClientPayment.js) |
| Lettrage paie | [src/lib/payroll/lettering.js](../src/lib/payroll/lettering.js) |
| Grand livre | [src/app/ledger/page.jsx](../src/app/ledger/page.jsx) |
| Détail compte grand livre | [src/app/ledger/[accountId]/page.jsx](../src/app/ledger/[accountId]/page.jsx) |
