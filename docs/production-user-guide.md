# Guide opératoire - Production

Ce guide couvre le socle simple du module Production.

## 1. Objectif

Le module permet de fabriquer un produit fini stockable à partir de composants déjà en stock.

Le parcours standard est :

1. créer une nomenclature
2. activer la nomenclature
3. créer un ordre de fabrication
4. lancer l'ordre
5. consommer les composants
6. déclarer le produit fini
7. clôturer l'ordre

## 2. Accès

Menu :

```text
Production
```

Écrans principaux :

| Écran | Usage |
| --- | --- |
| `/production` | vue générale production |
| `/production/boms` | liste des nomenclatures |
| `/production/boms/create` | création d'une nomenclature |
| `/production/orders` | liste des ordres de fabrication |
| `/production/orders/create` | création d'un ordre |
| `/production/orders/[id]` | pilotage de l'ordre |

## 3. Préparer les produits

Les composants et produits finis viennent du catalogue `Produits`.

Chaque produit utilisé en production doit avoir :

- un compte de stock
- un compte de variation stock
- du stock disponible pour les composants consommés

Le produit fini peut être marqué comme `FINISHED_GOODS` avec un compte de stock `36x`.

## 4. Créer une nomenclature

Aller dans :

```text
Production > Nomenclatures > Nouvelle nomenclature
```

Renseigner :

- le produit fini
- le libellé
- la version
- les composants
- les quantités standard
- le taux de perte éventuel

Après création, activer la nomenclature depuis la liste.

## 5. Créer un ordre de fabrication

Aller dans :

```text
Production > Ordres de fabrication > Nouvel ordre
```

Renseigner :

- la nomenclature active
- la quantité à produire
- le compte de production en cours
- la date prévue
- une note éventuelle

Le numéro est généré automatiquement avec le préfixe `MO-`.

## 6. Piloter l'ordre

La fiche d'ordre affiche un parcours guidé :

| Étape | Action |
| --- | --- |
| `DRAFT` | lancer l'ordre |
| `RELEASED` | consommer les composants |
| `IN_PROGRESS` | déclarer la production |
| `COMPLETED` | clôturer l'ordre |
| `CLOSED` | cycle terminé |

La consommation automatique prélève les quantités restantes prévues par la nomenclature.

## 7. Impact stock et comptable

À la consommation :

- les composants sortent du stock
- le compte de production en cours est débité
- le compte de stock composant est crédité

À la déclaration :

- le produit fini entre en stock
- le compte de stock produit fini est débité
- le compte de production en cours est crédité

## 8. Références techniques

Le smoke de référence est :

```bash
npm run test:production-flow
```

Il vérifie :

- création de nomenclature
- activation
- création d'ordre `MO-`
- consommation stock
- déclaration produit fini
- clôture
- écritures équilibrées
