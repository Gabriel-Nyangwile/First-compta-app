# Guide opératoire - Ouverture et clôture d'exercice

Ce guide regroupe le cycle d'exercice : reprise d'ouverture, contrôle des données initiales, clôture annuelle, génération des à-nouveaux et verrouillage de l'exercice clôturé.

## 1. Objectif

Le cycle d'exercice sert à garantir que la société commence ou termine une période comptable avec des soldes cohérents.

Deux situations sont couvertes :

| Situation | Procédure |
| --- | --- |
| Nouvelle société ou reprise depuis un ancien logiciel | Ouverture d'exercice |
| Exercice complet tenu dans l'application | Clôture annuelle puis génération des à-nouveaux |

Ne pas confondre les deux procédures. L'ouverture charge une situation initiale. La clôture calcule la fin d'un exercice déjà tenu dans l'application.

## 2. Accès dans l'application

Pour la reprise d'ouverture :

```text
Comptabilité > Ouverture d'exercice
```

Pour la clôture annuelle :

```text
Comptabilité > Clôture annuelle
```

Ces écrans sont réservés aux profils comptables habilités.

## 3. Rôles concernés

Les opérations d'ouverture et de clôture sont sensibles. Elles doivent être réservées à :

- Super admin société
- Responsable finance
- Comptable autorisé

Un utilisateur en lecture seule ne doit pas importer d'ouverture ni générer de clôture.

## 4. Comprendre l'ouverture d'exercice

L'ouverture d'exercice sert à créer le point de départ d'une société dans l'application.

Elle peut importer :

- une balance générale
- le stock initial
- les soldes clients
- les soldes fournisseurs
- les immobilisations existantes

Chaque import peut être prévisualisé avant validation.

## 5. Préparer l'ouverture

Avant import :

1. créer la société
2. vérifier le plan comptable
3. définir la date d'ouverture
4. préparer les fichiers Excel
5. contrôler que les soldes sont cohérents avec la situation de départ

La date d'ouverture est généralement le premier jour de l'exercice, par exemple `2026-01-01`.

## 6. Télécharger les modèles

Dans l'écran d'ouverture, télécharger les modèles Excel proposés.

Les modèles couvrent :

| Modèle | Contenu |
| --- | --- |
| Balance | comptes et soldes d'ouverture |
| Stock | produits, quantités et coûts |
| Clients | clients et soldes ouverts |
| Fournisseurs | fournisseurs et soldes ouverts |
| Immobilisations | actifs, coûts, amortissements cumulés |

## 7. Ordre conseillé des imports

Respecter l'ordre suivant :

1. Balance générale
2. Stock initial
3. Clients
4. Fournisseurs
5. Immobilisations

Cet ordre limite les conflits de comptes, de tiers et de données liées.

## 8. Prévisualiser avant import

Pour chaque fichier :

1. choisir le type d'import
2. sélectionner le fichier Excel
3. cliquer sur **Prévisualiser**
4. lire le rapport
5. corriger les erreurs si nécessaire
6. importer seulement lorsque le rapport est propre

La prévisualisation ne modifie pas la base.

## 9. Importer définitivement

Après validation du rapport :

1. cliquer sur **Importer**
2. attendre le message de succès
3. contrôler les données créées
4. passer au fichier suivant

L'application protège les imports contre plusieurs réimports accidentels lorsque les données existent déjà.

## 10. Contrôler l'ouverture

Après l'ouverture, vérifier :

- le journal d'ouverture
- la balance générale
- les soldes clients
- les soldes fournisseurs
- le stock valorisé
- les immobilisations reprises
- les amortissements cumulés

Une ouverture correcte doit permettre de commencer l'exploitation courante sans écriture manuelle de correction.

## 11. Comprendre la clôture annuelle

La clôture annuelle sert à terminer un exercice tenu dans l'application.

Elle permet de :

- contrôler la balance de clôture
- calculer le résultat avant impôt
- simuler puis valider l'impôt société ou l'impôt minimum
- préparer l'affectation du résultat net selon la décision AGO
- générer les à-nouveaux de l'exercice suivant
- créer une fiche de clôture
- verrouiller l'exercice clôturé

## 12. Préparer la clôture

Avant de clôturer :

1. vérifier que toutes les factures sont comptabilisées
2. rapprocher les paiements et lettrages
3. contrôler la trésorerie
4. comptabiliser les amortissements
5. traiter les stocks et inventaires
6. saisir les écritures d'inventaire
7. vérifier que le journal est équilibré

La clôture ne remplace pas les contrôles comptables. Elle les formalise.

## 13. Fiscalité du résultat

Avant génération définitive des à-nouveaux, l'application propose une étape **Impôt société et affectation AGO**.

Deux cas sont distingués :

| Situation | Traitement |
| --- | --- |
| Perte | calcul de l'impôt minimum sur le chiffre d'affaires annuel |
| Bénéfice | calcul de l'impôt société sur le résultat bénéficiaire |

Les taux proposés par défaut sont :

| Élément | Taux par défaut |
| --- | --- |
| Impôt société | 30% |
| Impôt minimum | 1% du chiffre d'affaires annuel |
| IRM sur dividendes | 20% |

Ces taux restent modifiables avant validation afin de s'adapter au cadre fiscal applicable à la société.

## 14. Affectation du résultat par AGO

Lorsque le résultat net après impôt est bénéficiaire, l'Assemblée Générale Ordinaire peut décider l'affectation du solde.

L'ordre appliqué est :

1. apurement du report à nouveau débiteur
2. dotation à la réserve légale
3. dotation aux réserves statutaires obligatoires si elles existent
4. détermination du bénéfice distribuable
5. dotation éventuelle aux réserves facultatives
6. distribution éventuelle de dividendes
7. calcul de l'IRM sur dividendes
8. détermination du report à nouveau final

La réserve légale est proposée à 10% du bénéfice disponible après apurement du report à nouveau débiteur, dans la limite de 20% du capital social.

Les dividendes sont répartis entre les associés selon les souscriptions de capital disponibles dans le module Capital. L'application calcule :

- le dividende brut
- l'IRM retenu
- le dividende net à payer

Si aucune base de répartition n'est disponible, la distribution est bloquée jusqu'à correction des associés ou souscriptions.

## 15. Comptes de résultat à vérifier

Le résultat est reporté via les comptes prévus.

Par défaut :

| Situation | Compte |
| --- | --- |
| Bénéfice reporté | `121100` |
| Perte reportée | `129100` |

Ces comptes doivent exister avant génération.

Les comptes utilisés par l'affectation doivent également exister :

| Usage | Compte par défaut |
| --- | --- |
| Impôt sur bénéfices | `891000` |
| Impôt minimum forfaitaire | `895000` |
| État, impôt sur bénéfices | `441000` |
| Réserve légale | `113800` |
| Réserve facultative | `118100` |
| Dividendes à payer | `465000` |
| IRM à reverser | `447000` |

Ces comptes sont modifiables dans l'écran de clôture avant validation.

## 16. Procédure de clôture

Dans l'écran de clôture :

1. saisir l'exercice à clôturer
2. cliquer sur **Contrôler**
3. lire les anomalies éventuelles
4. corriger les anomalies bloquantes
5. simuler l'impôt société et l'affectation AGO
6. renseigner les réserves statutaires, réserves facultatives et dividendes si nécessaire
7. cliquer sur **Valider fiscalité / AGO**
8. relancer le contrôle si l'écran le demande
9. vérifier la simulation des à-nouveaux
10. cliquer sur **Générer N+1**
11. confirmer l'opération
12. consulter la fiche de clôture
13. ouvrir le journal d'à-nouveaux

## 17. À-nouveaux

Les à-nouveaux reprennent les comptes de bilan.

Les comptes de charges et produits ne sont pas reportés directement. Leur solde est intégré au résultat reporté.

Si une affectation AGO validée existe, le résultat net est ventilé dans le journal d'à-nouveaux entre :

- réserve légale
- réserves statutaires
- réserves facultatives
- dividendes nets à payer
- IRM à reverser
- report à nouveau final

Le journal d'à-nouveaux doit être contrôlé comme toute autre pièce comptable.

## 18. Fiche de clôture

Après génération, la fiche de clôture affiche :

- l'exercice clôturé
- la période verrouillée
- le statut
- le journal d'à-nouveaux
- la date de création
- la note éventuelle

Cette fiche constitue le point de référence pour savoir si un exercice est verrouillé.

## 19. Effet du verrouillage

Une fois l'exercice clôturé, les nouvelles écritures datées dans cet exercice sont refusées.

Le verrou couvre notamment :

- les écritures comptables
- les factures générant des écritures
- les dotations d'amortissement
- les cessions d'immobilisations
- les écritures issues des modules métier

## 20. Cas des immobilisations

Les immobilisations doivent être contrôlées avant clôture.

Vérifier :

- acquisitions de l'exercice
- amortissements mensuels
- cessions ou sorties
- cohérence entre tableau d'amortissement et journal

Une dotation de décembre doit être datée au 31 décembre de l'exercice concerné.

## 21. Cas du stock

Avant clôture :

- contrôler les quantités
- vérifier le coût moyen
- traiter les écarts d'inventaire
- s'assurer que les mouvements importants sont comptabilisés

Un stock incohérent fausse le résultat et la situation de clôture.

## 22. Cas clients et fournisseurs

Avant clôture :

- vérifier les factures non réglées
- contrôler les lettrages partiels
- rapprocher les règlements
- identifier les soldes anciens ou litigieux

Les soldes clients et fournisseurs repris en N+1 doivent correspondre à la réalité.

## 23. Dépannage ouverture

### Balance non équilibrée

Cause : total débit différent du total crédit.

Action : corriger le fichier avant import.

### Compte inexistant

Cause : une ligne référence un compte absent du plan comptable.

Action : créer le compte ou corriger le numéro.

### Duplicata détecté

Cause : les données ont déjà été importées.

Action : contrôler l'existant avant de relancer.

### Catégorie d'immobilisation inconnue

Cause : le fichier d'ouverture immobilisations référence une catégorie absente.

Action : créer ou corriger la catégorie.

## 24. Dépannage clôture

### Journal non équilibré

Cause : le total débit de l'exercice ne correspond pas au total crédit.

Action : corriger les écritures avant de relancer le contrôle.

### À-nouveaux déjà générés

Cause : un journal d'à-nouveaux existe déjà pour l'exercice suivant.

Action : ouvrir le journal indiqué et vérifier qu'il correspond à la clôture attendue.

### Exercice déjà clôturé

Cause : une fiche de clôture existe déjà.

Action : consulter la fiche existante et éviter toute double génération.

### Compte de résultat introuvable

Cause : le compte de bénéfice ou perte reportée n'existe pas.

Action : créer le compte puis relancer.

### Compte fiscal ou AGO introuvable

Cause : l'un des comptes d'impôt, réserve, dividendes ou IRM n'existe pas.

Action : créer le compte ou modifier le numéro proposé dans l'écran de clôture.

### Dividendes sans associés

Cause : une distribution a été saisie, mais aucune base de répartition n'est disponible dans le module Capital.

Action : vérifier les associés et les souscriptions de capital avant validation.

### Réserves et dividendes supérieurs au bénéfice distribuable

Cause : les montants décidés dépassent le bénéfice disponible.

Action : réduire les réserves facultatives ou les dividendes.

## 25. Bonnes pratiques

- toujours prévisualiser les imports d'ouverture
- conserver les fichiers Excel utilisés
- ne pas importer deux fois les mêmes soldes
- traiter les amortissements avant clôture
- lettrer les comptes clients et fournisseurs avant clôture
- générer les exports utiles au dossier de clôture
- ne pas contourner le verrou d'exercice sans procédure formelle

## 24. Références techniques

- Guide détaillé d'ouverture : `docs/opening-balance.md`
- Guide détaillé de clôture : `docs/annual-closing.md`
- Tests liés : `npm run test:opening`, `npm run test:closing`
