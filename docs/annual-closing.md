# Guide utilisateur - Cloture annuelle et reouverture

## Vue d'ensemble

Ce guide explique comment cloturer un exercice tenu dans l'application, generer les a-nouveaux de l'exercice suivant et verifier que l'exercice cloture est bien verrouille.

Pour une societe dont l'historique vient d'un autre logiciel ou d'Excel, utiliser plutot la reprise d'ouverture : [opening-balance.md](./opening-balance.md).

## Acces utilisateur

Dans l'application, ouvrir :

```text
Comptabilite > Cloture annuelle
```

L'ecran permet de :

- choisir l'exercice a cloturer
- controler la balance de cloture
- afficher le resultat de l'exercice
- simuler les a-nouveaux de l'exercice suivant
- generer le journal d'a-nouveaux N+1
- visualiser la fiche de cloture liee au journal d'a-nouveaux

## Quand utiliser cette procedure

Utiliser cette procedure lorsque l'exercice complet a ete saisi dans l'application.

Exemple :

- les ecritures 2025 ont ete tenues dans l'application
- la balance 2025 est controlee
- les corrections d'inventaire, amortissements, provisions et regularisations sont termines
- l'utilisateur veut ouvrir 2026 automatiquement avec les soldes de bilan 2025

Ne pas utiliser cette procedure pour charger une balance issue d'un ancien logiciel. Dans ce cas, utiliser l'ouverture d'exercice.

## Principe comptable

La reouverture automatique reprend uniquement les comptes de bilan :

| Classe | Traitement |
| --- | --- |
| 1 a 5 | Reportes en a-nouveaux |
| 6 et 7 | Non reportes directement |

Le resultat de l'exercice est calcule a partir des classes 6 et 7, puis ajoute dans le journal d'a-nouveaux sur le compte de resultat.

Par defaut :

| Situation | Compte |
| --- | --- |
| Benefice reporte | `121100` - Report a nouveau crediteur |
| Perte reportee | `129100` - Perte nette reportee |

Ces comptes doivent exister dans le plan comptable de la societe avant la generation.

## Prerequis

Avant de generer les a-nouveaux :

- le plan comptable de la societe doit etre complet
- le journal de l'exercice doit etre equilibre
- les comptes `121100` et `129100` doivent exister
- les ecritures d'inventaire doivent etre saisies
- les amortissements de l'exercice doivent etre comptabilises
- les a-nouveaux N+1 ne doivent pas deja exister
- l'exercice ne doit pas deja etre marque comme cloture

## Procedure utilisateur

1. Ouvrir **Comptabilite > Cloture annuelle**
2. Saisir l'exercice a cloturer
3. Verifier les comptes de resultat proposes
4. Cliquer sur **Controler**
5. Lire les totaux et les anomalies eventuelles
6. Corriger les anomalies si l'ecran en signale
7. Verifier la simulation des a-nouveaux
8. Cliquer sur **Generer N+1**
9. Confirmer l'operation
10. Controler la fiche de cloture affichee a l'ecran
11. Ouvrir le journal d'a-nouveaux depuis le lien de la fiche

## Visualiser la fiche de cloture

Apres generation, l'ecran affiche un bloc **Fiche de cloture**.

Cette fiche permet de verifier que l'operation a bien ete finalisee. Elle affiche :

- le statut de l'exercice, par exemple `Cloture`
- l'exercice cloture
- la periode verrouillee
- la date de creation de la cloture
- la date du journal d'a-nouveaux
- le numero du journal d'a-nouveaux
- une note de cloture

Pour revoir cette fiche plus tard :

1. retourner dans **Comptabilite > Cloture annuelle**
2. saisir le meme exercice
3. cliquer sur **Controler**
4. consulter le bloc **Fiche de cloture**

Le numero du journal est cliquable. Il ouvre la piece comptable d'a-nouveaux dans le journal.

Le journal d'a-nouveaux porte la reference source `CLOSING-AAAA`. Les lignes sont aussi consultables dans **Transactions** en filtrant sur le numero de journal, par exemple `JRN-000388`.

## Effet de la cloture

Quand les a-nouveaux sont generes, l'application cree une fiche de cloture pour l'exercice et lui associe le journal d'a-nouveaux.

Une fois la fiche creee, les nouvelles ecritures journalisees datees dans l'exercice cloture sont refusees cote serveur.

Ce verrou couvre notamment :

- les journaux generes par le moteur comptable commun
- les lignes comptables rattachees a ces journaux
- les creations, cessions et dotations d'immobilisations
- les dotations d'amortissement, comptabilisees a la date de fin du mois concerne

## Controles bloquants

La generation est refusee si :

- le journal de l'exercice n'est pas equilibre
- aucun compte de bilan n'est a reporter
- les a-nouveaux de l'exercice suivant existent deja
- l'exercice est deja marque comme cloture
- le compte de resultat requis est introuvable

## Cas des immobilisations

Les immobilisations doivent etre datees rigoureusement avant la cloture.

Les dotations d'amortissement sont comptabilisees sur la date de fin du mois concerne. Par exemple, la dotation de decembre 2025 est comptabilisee au 31/12/2025, et non a la date du jour.

Si un exercice est deja cloture, une nouvelle acquisition, cession ou dotation datee dans cet exercice est refusee.

## Depannage

### Message "Journal non equilibre"

Cause : le total debit de l'exercice ne correspond pas au total credit.

Action : corriger les ecritures avant de relancer le controle.

### Message "A-nouveaux deja generes"

Cause : un journal d'a-nouveaux existe deja a la date d'ouverture de N+1.

Action : ouvrir le journal indique et verifier qu'il correspond bien a la cloture attendue.

### Message "Exercice deja cloture"

Cause : une fiche de cloture existe deja pour cet exercice.

Action : utiliser **Controler** pour visualiser la fiche existante et ouvrir le journal d'a-nouveaux lie.

### Message "Compte de resultat introuvable"

Cause : le compte `121100` ou `129100` n'existe pas dans le plan comptable.

Action : creer le compte manquant, puis relancer la generation.

## Limite actuelle

La cloture normale et le verrouillage de l'exercice sont disponibles.

La reouverture exceptionnelle n'est pas encore exposee a l'utilisateur. Elle devra etre ajoutee avec :

- motif obligatoire
- droits reserves
- trace d'audit
- date et utilisateur de reouverture

## Verification technique

```bash
npm run test:closing
npm run build
```
