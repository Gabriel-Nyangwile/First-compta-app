# Manuel illustré - Opérations en capital

Ce document présente le cycle des opérations en capital sous une forme pratique et visuelle.

Il suit le comportement actuel de l'application et décrit les écritures réellement générées par les APIs. Les comptes mentionnés ici sont donc ceux effectivement utilisés aujourd'hui par le code.

## 1. Cas métier illustratif

Hypothèse de travail :

- capital social : `5 000`
- nombre de parts : `500`
- valeur nominale d'une part : `10`
- forme sociale : `SARL`
- opération : `CONSTITUTION`

Répartition retenue :

- Associé A : `3 000` soit `300` parts
- Associé B : `2 000` soit `200` parts

## 2. Comptes utilisés par l'application

| Compte | Libellé applicatif | Rôle actuel |
| --- | --- | --- |
| `109000` | Actionnaires, Capital Souscrit, Non Appele | souscriptions non appelées |
| `101100` | Capital Souscrit, Non Appele | contrepartie du compte 109 |
| `461200` | Associes Apports En Numeraire | créance sur les associés |
| `101200` | Capital Souscrit, Appele, Non Verse | capital appelé non encore régularisé |
| `101300` | Capital Souscrit, Appele, Verse, Non Amorti | reclassement final |
| `52xxxx` | Banque | encaissement banque |
| `57xxxx` | Caisse | encaissement caisse |

## 3. Vue d'ensemble du parcours

| Étape | Action | Effet comptable | Résultat métier |
| --- | --- | --- | --- |
| 1 | Créer l'opération de capital | aucune écriture | dossier de capital ouvert |
| 2 | Créer les associés | aucune écriture | associés disponibles pour souscription |
| 3 | Enregistrer les souscriptions | `109000 / 101100` | capital promis constaté |
| 4 | Corriger une souscription | ajustement sur `109000 / 101100` | capital souscrit remis au bon montant |
| 5 | Lancer un appel de fonds | `461200 / 109000 / 101100 / 101200` | capital rendu exigible |
| 6 | Enregistrer le versement | `52xxxx` ou `57xxxx` / `461200` | créance associée réduite, trésorerie augmentée |
| 7 | Régularisation finale | `101200 / 101300` | reclassement final du capital appelé et payé |

## 4. Étape 1 - Créer l'opération de capital

### Finalité

Créer le dossier principal qui va regrouper les souscriptions, les appels, les paiements et la régularisation finale.

### Illustration

| Étape | Action utilisateur | Écriture générée | Résultat |
| --- | --- | --- | --- |
| 1 | Créer une opération `CONSTITUTION` avec capital cible `5 000` | aucune | une opération `CAP-...` est créée |

### Données typiques à saisir

| Champ | Exemple |
| --- | --- |
| Forme | `SARL` |
| Type | `CONSTITUTION` |
| Capital cible | `5 000` |
| Référence décision | `STATUTS-2026-001` |
| Date de résolution | `2026-04-19` |

## 5. Étape 2 - Créer les associés

### Finalité

Enregistrer les personnes physiques ou morales qui participeront au capital.

### Illustration

| Étape | Action utilisateur | Écriture générée | Résultat |
| --- | --- | --- | --- |
| 2A | Créer `Jean Mutombo` | aucune | associé A disponible |
| 2B | Créer `Marie Kalala` | aucune | associé B disponible |
| 2C | Modifier email, téléphone ou adresse d'un associé | aucune | fiche associée mise à jour |

### Exemple de fiches

| Associé | Montant futur de souscription | Parts prévues |
| --- | --- | --- |
| Jean Mutombo | `3 000` | `300` |
| Marie Kalala | `2 000` | `200` |

## 6. Étape 3 - Enregistrer les souscriptions

### Finalité

Constater l'engagement de chaque associé sur sa part de capital.

### Logique actuelle

Lors de la création d'une souscription, l'application considère que la totalité du nominal est souscrite mais non appelée.

### Écriture unitaire

| Action | Débit | Crédit |
| --- | --- | --- |
| Création d'une souscription | `109000` | `101100` |

### Illustration détaillée

| Étape | Action utilisateur | Écriture générée | Résultat |
| --- | --- | --- | --- |
| 3A | Souscrire Jean Mutombo pour `3 000` et `300` parts | Dr `109000` `3 000` ; Cr `101100` `3 000` | promesse de souscription de Jean enregistrée |
| 3B | Souscrire Marie Kalala pour `2 000` et `200` parts | Dr `109000` `2 000` ; Cr `101100` `2 000` | promesse de souscription de Marie enregistrée |

### Situation après les souscriptions

| Compte | Mouvement cumulé |
| --- | --- |
| `109000` | Débit `5 000` |
| `101100` | Crédit `5 000` |

### Point d'attention

Le champ `premiumAmount` peut être saisi, mais il n'est pas comptabilisé automatiquement dans le flux actuel.

## 7. Étape 4 - Corriger une souscription

### Finalité

Corriger une erreur de montant nominal ou de nombre de parts.

### Logique actuelle

L'application ne reposte pas toute la souscription. Elle génère uniquement l'écart entre l'ancienne valeur et la nouvelle.

### Exemple illustré

Cas :

- souscription initiale de Marie : `1 900`
- montant correct : `2 000`
- écart à corriger : `100`

### Illustration détaillée

| Étape | Action utilisateur | Écriture générée | Résultat |
| --- | --- | --- | --- |
| 4A | Corriger la souscription de Marie de `1 900` à `2 000` | Dr `109000` `100` ; Cr `101100` `100` | la souscription est ramenée à son bon montant |

### Cas inverse

| Situation | Écriture |
| --- | --- |
| Diminution du nominal | Dr `101100` ; Cr `109000` |

### Contrôle intégré

La réduction d'une souscription est refusée si le nouveau nominal devient inférieur au total déjà appelé sur cette souscription.

## 8. Étape 5 - Lancer un appel de fonds

### Finalité

Rendre exigible tout ou partie de la souscription.

### Logique actuelle

L'appel de fonds :

- constate une créance sur l'associé
- diminue la part non appelée
- reclasse le capital souscrit non appelé vers le capital appelé non versé

### Écriture unitaire

| Mouvement | Compte |
| --- | --- |
| Débit | `461200` |
| Crédit | `109000` |
| Débit | `101100` |
| Crédit | `101200` |

### Exemple 1 - Appel partiel sur Jean

Montant appelé :

- `1 500`

| Étape | Action utilisateur | Écriture générée | Résultat |
| --- | --- | --- | --- |
| 5A | Appeler `1 500` sur la souscription de Jean | Dr `461200` `1 500` ; Cr `109000` `1 500` ; Dr `101100` `1 500` ; Cr `101200` `1 500` | `1 500` deviennent exigibles sur Jean |

### Exemple 2 - Appel du solde restant

Montants appelés ensuite :

- Jean : `1 500`
- Marie : `2 000`

Total :

- `3 500`

| Étape | Action utilisateur | Écriture générée | Résultat |
| --- | --- | --- | --- |
| 5B | Appeler le solde de `3 500` | Dr `461200` `3 500` ; Cr `109000` `3 500` ; Dr `101100` `3 500` ; Cr `101200` `3 500` | la totalité du capital souscrit devient appelée |

### Situation après appel total de `5 000`

| Compte | Effet métier |
| --- | --- |
| `109000` | la part appelée est sortie du non appelé |
| `101100` | reclassement du capital souscrit non appelé |
| `101200` | enregistre le capital appelé non versé |
| `461200` | porte la créance sur les associés |

## 9. Étape 6 - Enregistrer les versements

### Finalité

Constater la libération effective des fonds par les associés.

### Contrôle de compte

| Mode | Compte autorisé |
| --- | --- |
| Banque | `52xxxx` |
| Caisse | `57xxxx` |

### Écriture unitaire

| Action | Débit | Crédit |
| --- | --- | --- |
| Enregistrement d'un paiement | `52xxxx` ou `57xxxx` | `461200` |

### Exemple 1 - Versement partiel de Jean

Montant versé :

- `1 000` en banque

| Étape | Action utilisateur | Écriture générée | Résultat |
| --- | --- | --- | --- |
| 6A | Enregistrer un paiement de `1 000` sur l'appel de Jean | Dr `52xxxx` `1 000` ; Cr `461200` `1 000` | la banque augmente, l'appel passe en `PARTIAL` |

### Exemple 2 - Versement du solde de Jean

Montant versé :

- `500`

| Étape | Action utilisateur | Écriture générée | Résultat |
| --- | --- | --- | --- |
| 6B | Enregistrer le solde de `500` | Dr `52xxxx` `500` ; Cr `461200` `500` | l'appel de Jean passe en `PAID` |

### Exemple 3 - Versement complet de Marie

Montant versé :

- `2 000`

| Étape | Action utilisateur | Écriture générée | Résultat |
| --- | --- | --- | --- |
| 6C | Enregistrer le paiement de Marie pour `2 000` | Dr `52xxxx` `2 000` ; Cr `461200` `2 000` | l'appel de Marie passe en `PAID` |

### Situation après encaissement total

| Compte | Mouvement cumulé |
| --- | --- |
| `52xxxx` ou `57xxxx` | Débit `5 000` |
| `461200` | Crédit `5 000` |

## 10. Étape 7 - Lancer la régularisation finale

### Finalité

Reclasser les montants appelés et effectivement payés vers le compte final utilisé par le flux actuel.

### Règle de calcul

L'application compare :

- le total appelé
- le total payé

Puis elle retient le plus petit des deux montants.

### Écriture unitaire

| Action | Débit | Crédit |
| --- | --- | --- |
| Régularisation finale | `101200` | `101300` |

### Exemple 1 - Régularisation complète

Hypothèse :

- total appelé : `5 000`
- total payé : `5 000`

| Étape | Action utilisateur | Écriture générée | Résultat |
| --- | --- | --- | --- |
| 7A | Passer l'opération en `REGISTERED` avec `regularize = true` | Dr `101200` `5 000` ; Cr `101300` `5 000` | le capital appelé et payé est reclassé définitivement selon le schéma actuel |

### Exemple 2 - Régularisation partielle

Hypothèse :

- total appelé : `5 000`
- total payé : `4 200`

| Étape | Action utilisateur | Écriture générée | Résultat |
| --- | --- | --- | --- |
| 7B | Régulariser une opération partiellement payée | Dr `101200` `4 200` ; Cr `101300` `4 200` | seule la part réellement encaissée est régularisée |

## 11. Lecture d'ensemble sur le cas complet

### Cas complet sans erreur

| Étape | Action | Écriture | Résultat |
| --- | --- | --- | --- |
| 1 | Création de l'opération | aucune | dossier capital ouvert |
| 2 | Création des 2 associés | aucune | associés disponibles |
| 3 | Souscriptions `3 000` + `2 000` | Dr `109000` `5 000` ; Cr `101100` `5 000` | capital promis enregistré |
| 4 | Appel total `5 000` | Dr `461200` `5 000` ; Cr `109000` `5 000` ; Dr `101100` `5 000` ; Cr `101200` `5 000` | capital exigible constaté |
| 5 | Encaissement total `5 000` | Dr `52xxxx/57xxxx` `5 000` ; Cr `461200` `5 000` | créance éteinte, trésorerie augmentée |
| 6 | Régularisation finale `5 000` | Dr `101200` `5 000` ; Cr `101300` `5 000` | reclassement final effectué |

### Cas avec erreur de souscription puis correction

| Étape | Action | Écriture | Résultat |
| --- | --- | --- | --- |
| 1 | Souscription initiale erronée de Marie à `1 900` | Dr `109000` `1 900` ; Cr `101100` `1 900` | souscription incomplète |
| 2 | Correction à `2 000` | Dr `109000` `100` ; Cr `101100` `100` | souscription remise au bon montant |

## 12. Conseils pratiques

| Conseil | Pourquoi |
| --- | --- |
| Créer d'abord l'opération de capital | toutes les souscriptions et tous les appels s'y rattachent |
| Saisir les associés avant les souscriptions | la souscription dépend de l'identité de l'associé |
| Corriger vite une erreur de souscription | cela évite de propager l'erreur dans les appels de fonds |
| Utiliser un compte `52xxxx` en banque | contrôle imposé par l'API de paiement |
| Utiliser un compte `57xxxx` en caisse | contrôle imposé par l'API de paiement |
| Régulariser seulement après revue des encaissements | la régularisation se base sur le minimum entre appelé et payé |

## 13. Points d'attention

| Point | Conséquence |
| --- | --- |
| La création d'un associé n'écrit rien en comptabilité | opération purement administrative |
| La mise à jour d'un associé n'écrit rien en comptabilité | correction de fiche uniquement |
| La création de l'opération de capital n'écrit rien en comptabilité | le processus comptable commence à la souscription |
| `premiumAmount` est stocké mais non comptabilisé automatiquement | seule la partie nominale produit une écriture aujourd'hui |
| Les comptes décrits ici reflètent l'état actuel du code | ce manuel devra être mis à jour si le schéma comptable évolue |

## 14. Références techniques

| Élément | Fichier |
| --- | --- |
| Logique de posting capital | [src/lib/capitalPosting.js](</c:/Users/Tonton G/reactproject/first-compta/src/lib/capitalPosting.js>) |
| Création des associés | [src/app/api/shareholders/route.js](</c:/Users/Tonton G/reactproject/first-compta/src/app/api/shareholders/route.js>) |
| Mise à jour des associés | [src/app/api/shareholders/[id]/route.js](</c:/Users/Tonton G/reactproject/first-compta/src/app/api/shareholders/[id]/route.js>) |
| Création opération capital | [src/app/api/capital-operations/route.js](</c:/Users/Tonton G/reactproject/first-compta/src/app/api/capital-operations/route.js>) |
| Mise à jour et régularisation | [src/app/api/capital-operations/[id]/route.js](</c:/Users/Tonton G/reactproject/first-compta/src/app/api/capital-operations/[id]/route.js>) |
| Création souscription | [src/app/api/capital-operations/[id]/subscriptions/route.js](</c:/Users/Tonton G/reactproject/first-compta/src/app/api/capital-operations/[id]/subscriptions/route.js>) |
| Mise à jour souscription | [src/app/api/capital-subscriptions/[id]/route.js](</c:/Users/Tonton G/reactproject/first-compta/src/app/api/capital-subscriptions/[id]/route.js>) |
| Appel de fonds | [src/app/api/capital-calls/route.js](</c:/Users/Tonton G/reactproject/first-compta/src/app/api/capital-calls/route.js>) |
| Paiement appel de fonds | [src/app/api/capital-calls/[id]/payments/route.js](</c:/Users/Tonton G/reactproject/first-compta/src/app/api/capital-calls/[id]/payments/route.js>) |
