# Guide opératoire - Immobilisations

Ce guide décrit le cycle de gestion des immobilisations : catégories, bons de commande immobilisations, création des actifs, amortissements, cessions et contrôles de période.

## 1. Objectif du module

Le module Immobilisations permet de suivre les valeurs immobilisées de la société depuis leur acquisition jusqu'à leur sortie.

Il couvre :

- les catégories d'immobilisations
- les bons de commande d'immobilisations
- la facture fournisseur liée à l'acquisition
- la création des fiches immobilisations
- le calcul et la comptabilisation des amortissements
- les exports d'amortissements
- le verrouillage des périodes
- la cession ou sortie d'un actif

## 2. Accès dans l'application

Les écrans principaux sont :

```text
Immobilisations > Immobilisations
Immobilisations > BC immobilisations
```

Selon le rôle utilisateur, certaines actions peuvent être masquées ou refusées.

## 3. Rôles concernés

Les rôles généralement autorisés sont :

| Action | Rôles habituels |
| --- | --- |
| Créer une catégorie | Super admin, Finance, Comptable |
| Créer un BC immobilisation | Super admin, Finance, Achats |
| Approuver un BC immobilisation | Super admin, Finance |
| Générer la facture fournisseur | Super admin, Finance |
| Créer une fiche immobilisation | Super admin, Finance, Comptable |
| Comptabiliser les amortissements | Super admin, Finance, Comptable |
| Verrouiller une période | Super admin, Finance |

## 4. Préparer les catégories

Avant toute acquisition, créer les catégories d'immobilisations.

Une catégorie doit préciser :

- un code
- un libellé
- une durée d'amortissement en mois
- le compte d'actif immobilisé
- le compte d'amortissement cumulé
- le compte de dotation
- les comptes de plus-value ou moins-value si la cession est utilisée

Exemples :

| Catégorie | Compte actif | Amortissement | Dotation |
| --- | --- | --- | --- |
| Matériel informatique | 218300 | 281830 | 681120 |
| Mobilier | 218400 | 281840 | 681120 |
| Véhicules | 218200 | 281820 | 681120 |

Si les comptes de catégorie sont absents, l'acquisition ou la création d'immobilisation peut être bloquée.

## 5. Créer un bon de commande immobilisation

Ouvrir :

```text
Immobilisations > BC immobilisations > Nouveau BC
```

Saisir :

- le fournisseur
- la date attendue
- la devise
- les lignes d'immobilisation
- la catégorie de chaque ligne
- la quantité
- le prix unitaire
- le taux de TVA

Chaque ligne doit porter une catégorie d'immobilisation. Le libellé de ligne servira de base pour la fiche immobilisation.

## 6. Approuver le bon de commande

Une fois le BC vérifié :

1. ouvrir le détail du BC immobilisation
2. contrôler les lignes
3. approuver le BC

L'approbation confirme que l'acquisition peut être facturée et transformée en actifs.

## 7. Générer la facture fournisseur

Depuis le détail du BC immobilisation, utiliser l'action de génération de facture fournisseur.

L'application crée une facture fournisseur avec les comptes issus des catégories d'immobilisation.

Contrôler ensuite :

- le fournisseur
- les montants hors taxes
- la TVA
- les comptes d'immobilisation
- le total TTC

Si la facture est incohérente ou sans écritures, corriger d'abord les comptes de catégorie puis régénérer ou éditer la facture.

## 8. Créer les immobilisations

Depuis le BC immobilisation, utiliser l'action de création d'immobilisation.

L'application crée une fiche par ligne ou par quantité selon le traitement prévu dans l'écran.

Chaque fiche contient notamment :

- une référence
- un libellé
- une catégorie
- une date d'acquisition
- un coût d'acquisition
- une valeur résiduelle éventuelle
- une durée de vie
- un statut

## 9. Saisir une immobilisation directement

Dans certains cas, il est possible de créer une immobilisation sans passer par un BC :

```text
Immobilisations > Immobilisations
```

Utiliser cette voie pour :

- une reprise historique
- une correction contrôlée
- une immobilisation déjà comptabilisée ailleurs

Pour les acquisitions courantes, privilégier le flux BC immobilisation puis facture fournisseur.

## 10. Générer les amortissements

Pour une immobilisation donnée :

1. choisir l'année
2. choisir le mois
3. générer la ligne d'amortissement
4. vérifier le montant proposé

Le calcul tient compte :

- du coût d'acquisition
- de la durée d'amortissement
- de la date d'acquisition
- des amortissements déjà générés
- de la valeur résiduelle

## 11. Comptabiliser les amortissements

Après génération, l'amortissement doit être comptabilisé.

L'écriture attendue est généralement :

| Sens | Compte |
| --- | --- |
| Débit | Compte de dotation |
| Crédit | Compte d'amortissement cumulé |

La date comptable correspond à la fin du mois concerné.

Exemple : une dotation de décembre 2026 est comptabilisée au 31/12/2026.

## 12. Traitement par lot

Le module permet aussi de traiter les amortissements par période.

Cas d'usage :

- générer toutes les dotations d'un mois
- comptabiliser les dotations d'une période
- exporter le détail pour contrôle
- verrouiller la période après validation

Avant de verrouiller une période, vérifier que les montants sont cohérents et que toutes les immobilisations attendues sont présentes.

## 13. Exports et planning

Les exports permettent de contrôler :

- le tableau des amortissements
- les lignes comptabilisées
- les immobilisations par catégorie
- les dotations par période

Ces exports servent de support aux contrôles comptables et aux dossiers de clôture.

## 14. Cession ou sortie d'une immobilisation

Lorsqu'une immobilisation est vendue ou sortie :

1. ouvrir la fiche de l'immobilisation
2. saisir la date de sortie
3. saisir le prix de cession si applicable
4. valider l'opération

L'application calcule la valeur nette comptable et peut produire l'écriture de sortie selon les comptes de catégorie.

Contrôler particulièrement :

- l'amortissement cumulé
- la valeur nette comptable
- le produit de cession
- la plus-value ou moins-value

## 15. Effet de la clôture d'exercice

Une immobilisation datée dans un exercice clôturé ne doit plus être modifiée par une opération comptable.

Sont notamment bloqués sur une période clôturée :

- nouvelle acquisition
- dotation d'amortissement
- cession
- sortie

Si une correction est nécessaire après clôture, elle doit passer par une procédure exceptionnelle validée par le responsable comptable.

## 16. Contrôles courants

Avant clôture, vérifier :

- toutes les catégories ont des comptes complets
- toutes les acquisitions de l'exercice ont une fiche immobilisation
- toutes les dotations mensuelles attendues sont générées
- les dotations sont comptabilisées
- les cessions de l'exercice sont traitées
- les exports d'amortissement concordent avec le journal

## 17. Dépannage

### Catégorie sans compte

Cause : la catégorie d'immobilisation n'a pas tous les comptes nécessaires.

Action : compléter la catégorie puis relancer l'opération.

### Facture fournisseur sans écriture

Cause : facture générée avant paramétrage complet des comptes.

Action : corriger les comptes de catégorie puis éditer ou régénérer la facture si le flux le permet.

### Amortissement impossible

Causes possibles :

- période déjà verrouillée
- exercice clôturé
- durée d'amortissement absente
- immobilisation sortie
- ligne déjà générée

Action : lire le message affiché, corriger la cause puis relancer.

### Montant de dotation inattendu

Causes possibles :

- date d'acquisition incorrecte
- durée de vie incorrecte
- valeur résiduelle mal renseignée
- amortissements antérieurs déjà présents

Action : contrôler la fiche immobilisation et l'historique des lignes d'amortissement.

## 18. Bonnes pratiques

- créer les catégories avant les acquisitions
- éviter les comptes de secours ou comptes génériques
- passer par le BC immobilisation pour les acquisitions courantes
- contrôler les amortissements avant comptabilisation
- verrouiller les périodes seulement après revue
- conserver les exports dans le dossier de clôture

## 19. Références techniques

- Routes principales : `/api/assets`, `/api/asset-categories`, `/api/asset-purchase-orders`
- Écrans : `/assets`, `/asset-purchase-orders`
- Tests liés : `npm run test:opening`, `npm run test:closing`
