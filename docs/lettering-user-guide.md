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

## 5. Pourquoi le lettrage peut encore sembler incomplet

Le flux client/fournisseur privilégie désormais le lettrage **depuis la facture**.

Le bouton **Lettrer la facture** associe explicitement :

- la ligne de dette ou de créance issue de la facture
- le ou les paiements encore disponibles pour ce même tiers
- une référence commune `LTR-...`

L'ancien bouton présent sur certaines lignes de paiement reste affiché pour compatibilité et diagnostic, mais le parcours recommandé pour un lettrage métier complet est de partir de la facture à solder.

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
| **Lettrer la facture** | impute les paiements disponibles sur la facture sélectionnée |
| **Ancien mode** | action conservée pour compatibilité sur certaines lignes de paiement |

### Parcours utilisateur

1. ouvrir le fournisseur
2. repérer la facture fournisseur à solder
3. cliquer sur **Lettrer la facture**
4. vérifier le message de réussite et la référence `LTR-...`
5. contrôler le statut `MATCHED` ou `PARTIAL`
6. vérifier le grand livre fournisseur

### Résultat attendu

Le lettrage fournisseur relie maintenant la dette issue de la facture et les paiements fournisseur disponibles sous une même référence de lettrage. Si le paiement couvre tout le montant, la facture passe en `MATCHED`. Sinon elle reste en `PARTIAL` avec un reliquat visible.

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
| **Lettrer la facture** | impute les encaissements disponibles sur la facture sélectionnée |
| **Ancien mode** | action conservée pour compatibilité sur certaines lignes d'encaissement |

### Parcours utilisateur

1. ouvrir le client
2. repérer la facture client à solder
3. cliquer sur **Lettrer la facture**
4. vérifier la référence `LTR-...`
5. contrôler le grand livre client

### Résultat attendu

Le lettrage client relie maintenant la créance `411` et les encaissements disponibles du même client. Le statut devient `MATCHED` si le montant est totalement couvert, ou `PARTIAL` si l'encaissement reste insuffisant.

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
| `UNMATCHED` avec paiement existant | le paiement n'a pas encore été imputé à une facture ou concerne un autre tiers |
| `PARTIAL` | paiement partiel ou différence de montant |
| `MATCHED` mais facture encore ouverte | incohérence à auditer entre statut facture et statut lettrage |
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

## 15. Point d'attention

Le lettrage facture-paiement client/fournisseur est désormais opérationnel sur le parcours standard.

Les évolutions restantes relèvent surtout du confort utilisateur :

- sélection manuelle d'un sous-ensemble de paiements
- affectation manuelle d'un montant sur un paiement précis
- traitement dédié des avances et acomptes

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
| Match facture tiers | [src/lib/lettering/matchPartyInvoice.js](../src/lib/lettering/matchPartyInvoice.js) |
| Match fournisseur actuel | [src/lib/lettering/matchSupplierPayment.js](../src/lib/lettering/matchSupplierPayment.js) |
| Match client actuel | [src/lib/lettering/matchClientPayment.js](../src/lib/lettering/matchClientPayment.js) |
| Test de non-régression | [scripts/test-lettering-flow.js](../scripts/test-lettering-flow.js) |
| Lettrage paie | [src/lib/payroll/lettering.js](../src/lib/payroll/lettering.js) |
| Grand livre | [src/app/ledger/page.jsx](../src/app/ledger/page.jsx) |
| Détail compte grand livre | [src/app/ledger/[accountId]/page.jsx](../src/app/ledger/[accountId]/page.jsx) |
