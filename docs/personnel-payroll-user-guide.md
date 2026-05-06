# Guide opératoire - Gestion du personnel et paie

Ce guide est destiné aux utilisateurs RH, paie, comptables et trésorerie qui travaillent sur le cycle **Personnel / Paie**.

Il décrit le parcours réel de l'application, le vocabulaire affiché à l'écran, les contrôles à effectuer et la lecture comptable associée. La paie est traitée comme un cycle mensuel complet : données salariés, saisies variables, calcul, bulletins, clôture, comptabilisation, règlement et archivage.

## 1. À quoi sert le module Personnel / Paie

Le module sert à :

- gérer les **salariés**
- gérer les **postes**
- suivre l'**historique des changements**
- créer et suivre les **périodes de paie**
- saisir les **présences**
- saisir les **variables de paie**
- renseigner le **taux fiscal de la période**
- prévisualiser et générer les **bulletins**
- produire les **PDF de bulletins**
- verrouiller, poster et clôturer une **période de paie**
- suivre les **passifs paie**
- régler le **net salariés**
- régler les organismes **CNSS**, **ONEM**, **INPP** et l'**IPR**
- exporter les états de paie en **JSON**, **CSV**, **PDF** et **XLSX**

## 2. Vocabulaire utilisateur

| Terme affiché | Sens métier |
| --- | --- |
| **Gestion du Personnel** | écran de création et mise à jour des salariés |
| **Matricule** | numéro interne unique du salarié |
| **Poste** | fonction occupée par le salarié |
| **Type contrat** | CDI, CDD ou CI |
| **Statut** | état administratif du salarié |
| **ACTIVE** | salarié actif, pris en compte dans la paie |
| **INACTIVE** | salarié inactif |
| **SUSPENDED** | salarié suspendu |
| **EXITED** | salarié sorti |
| **Périodes de paie** | liste des mois de paie |
| **OPEN** | période ouverte, saisies et recalculs autorisés |
| **LOCKED** | période verrouillée, bulletins figés avant comptabilisation |
| **POSTED** | période comptabilisée |
| **SETTLED** | période comptabilisée et passifs paie entièrement réglés |
| **Présence** | données de jours travaillés, jours ouvrés et heures supplémentaires |
| **Variables** | éléments ponctuels : bonus, indemnités, retenues |
| **Taux fiscal de la période** | taux de conversion entre devise de traitement et devise fiscale |
| **Devise de traitement** | devise par défaut de la société, utilisée pour les bulletins et écritures |
| **Devise fiscale** | devise de calcul fiscal, actuellement `CDF` |
| **Prévisualiser** | calculer sans enregistrer définitivement les bulletins |
| **Générer bulletins** | créer ou recalculer les bulletins de la période |
| **Recalculer tous les bulletins** | régénérer les bulletins après modification du taux, de la présence ou des variables |
| **Clôturer et ouvrir suivante** | verrouiller/poster la période et créer la période suivante |
| **Passifs paie** | dettes envers salariés, organismes sociaux et fisc |
| **Lettrage paie** | rapprochement des dettes paie avec leurs paiements |

## 3. Vue d'ensemble du cycle mensuel

| Étape | Action utilisateur | Résultat attendu |
| --- | --- | --- |
| 1 | mettre à jour les salariés actifs | population paie correcte |
| 2 | créer ou sélectionner la période `OPEN` | mois de paie prêt à traiter |
| 3 | saisir le taux fiscal si nécessaire | calcul fiscal possible |
| 4 | saisir présences et variables | éléments du mois pris en compte |
| 5 | prévisualiser la paie | contrôle avant génération |
| 6 | générer les bulletins | bulletins enregistrés |
| 7 | contrôler le détail de période | totaux et passifs vérifiés |
| 8 | verrouiller ou clôturer la période | bulletins figés |
| 9 | poster la période | journal de paie généré |
| 10 | régler salariés et organismes | passifs diminués et lettrés |
| 11 | exporter et archiver | dossier paie du mois complet |

## 4. Règle de devise paie

La règle retenue est la suivante :

| Élément | Règle |
| --- | --- |
| **Devise de traitement** | devise par défaut de la société |
| **Devise fiscale** | `CDF` pour les calculs fiscaux et sociaux |
| **Base IPR/CNSS/ONEM/INPP** | convertie en `CDF` avant calcul |
| **Bulletin final** | reconverti en devise de traitement |
| **Écriture comptable** | enregistrée en devise de traitement |

### Exemple

Si la société travaille en `EUR` :

1. le brut est saisi et restitué en `EUR`
2. l'application convertit la base en `CDF` avec le **taux fiscal de la période**
3. l'IPR, la CNSS, l'ONEM et l'INPP sont calculés sur base fiscale
4. les retenues et charges sont reconverties en `EUR`
5. le bulletin et les écritures restent en `EUR`

Si la société travaille déjà en `CDF`, le taux peut être `1`.

## 5. Étape 1 - Mettre à jour les salariés

### Où aller

Ouvrir l'écran **Gestion du Personnel**.

### Champs importants

| Champ écran | Utilisation |
| --- | --- |
| **Prénom** | identité du salarié |
| **Nom** | identité du salarié |
| **Email** | contact |
| **Téléphone** | contact |
| **Adresse** | information administrative |
| **Genre** | information RH |
| **État civil** | utilisé pour le dossier administratif |
| **Enfants < 18 ans** | donnée utile pour certains calculs ou contrôles paie |
| **N° Sécurité sociale** | identifiant social |
| **Date naissance** | calculs d'âge et statistiques personnel |
| **Date embauche** | ancienneté et effectif |
| **Date sortie** | sortie du personnel |
| **Matricule** | référence interne du salarié |
| **Type contrat** | CDI, CDD ou CI |
| **Statut** | condition de prise en compte en paie |
| **Poste** | fonction occupée |
| **Catégorie** | catégorie issue du poste ou de la configuration |

### Point clé pour la paie

Seuls les salariés actifs doivent être maintenus en statut **ACTIVE** pour le traitement courant. Avant chaque paie, vérifier les entrées, sorties et suspensions.

## 6. Étape 2 - Contrôler les postes et catégories

Les postes permettent de rattacher le salarié à une fonction. La catégorie peut être utilisée pour organiser ou contrôler les salariés.

### Bonnes pratiques

| Conseil | Pourquoi |
| --- | --- |
| créer les postes avant les salariés | évite les fiches incomplètes |
| éviter les intitulés ambigus | facilite le contrôle RH |
| contrôler les catégories | réduit les erreurs de classement |

## 7. Étape 3 - Créer ou sélectionner une période de paie

### Où aller

Ouvrir **Périodes de paie** ou **Gestion paie**.

### Statuts possibles

| Statut | Ce que l'utilisateur peut faire |
| --- | --- |
| **OPEN** | saisir, modifier, recalculer, générer |
| **LOCKED** | consulter, poster ou déverrouiller si autorisé |
| **POSTED** | consulter, exporter, régler et lettrer |
| **SETTLED** | consulter, exporter et archiver, plus aucun règlement restant |

### Parcours conseillé

1. vérifier qu'une période `OPEN` existe pour le mois
2. sinon cliquer sur **Créer période courante**
3. sélectionner la période à traiter
4. ouvrir **Saisies**

## 8. Étape 4 - Saisir le taux fiscal de la période

### Où aller

Dans la page des **Saisies** de la période.

Le bloc s'appelle **Taux fiscal de la période**.

### Champs affichés

| Champ écran | Rôle |
| --- | --- |
| **Devise de traitement** | devise de la société |
| **Devise fiscale** | devise de calcul fiscal, généralement `CDF` |
| **Taux de change** | taux saisi par l'utilisateur |
| **Enregistrer le taux** | sauvegarde le taux de la période |

### Règle opérationnelle

Après modification du taux, cliquer sur **Recalculer tous les bulletins**.

### Point de contrôle

Si la devise de traitement est différente de `CDF`, la génération ou la clôture doit être bloquée si le taux est vide ou inférieur/égal à zéro.

## 9. Étape 5 - Saisir la présence

### Où aller

Dans **Saisies**, bloc **Présence (pro-rata de base)**.

### Champs

| Champ écran | Rôle |
| --- | --- |
| **Employé** | salarié concerné |
| **Jours travaillés** | base réelle travaillée |
| **Jours ouvrés** | base normale du mois |
| **Heures supp** | heures supplémentaires du mois |
| **Notes** | commentaire libre |

### Effet sur la paie

La présence sert au prorata de la rémunération de base et à l'intégration des heures supplémentaires.

### Bon réflexe

Contrôler les absences et sorties avant de générer les bulletins.

## 10. Étape 6 - Saisir les variables de paie

### Où aller

Dans **Saisies**, bloc **Variables (bonus/indemnités/retenues)**.

### Types disponibles

| Type | Sens métier |
| --- | --- |
| **BONUS** | prime ou gratification positive |
| **ALLOWANCE** | indemnité ou avantage positif |
| **DEDUCTION** | retenue ou déduction |

### Champs

| Champ écran | Rôle |
| --- | --- |
| **Employé** | salarié concerné |
| **Kind** | nature de la variable |
| **Libellé** | texte visible dans le bulletin |
| **Montant** | montant en devise de traitement |
| **Centre de coûts** | imputation analytique optionnelle |

### Effet sur le bulletin

Les variables modifient le brut, les retenues ou le net selon leur nature. Elles doivent être revues avant verrouillage.

## 11. Étape 7 - Prévisualiser la paie

### Où aller

Dans **Gestion paie**, cliquer sur **Prévisualiser**.

### Ce que l'écran affiche

| Colonne | Lecture |
| --- | --- |
| **Employé** | salarié calculé |
| **Brut** | rémunération brute |
| **Net** | montant net à payer |
| **CNSS Sal.** | retenue salariale CNSS |
| **IPR** | impôt professionnel sur rémunération |
| **RI Base** | base imposable |
| **CNSS Emp.** | charge patronale CNSS |
| **ONEM** | charge patronale ONEM |
| **INPP** | charge patronale INPP |
| **Charges Employeur** | total charges employeur |
| **Lignes** | nombre de lignes de bulletin |

### Objectif

La prévisualisation permet de contrôler avant enregistrement définitif.

## 12. Étape 8 - Générer les bulletins

### Action

Cliquer sur **Générer bulletins** ou **Recalculer tous les bulletins**.

### Résultat attendu

L'application crée les bulletins de la période et leurs lignes détaillées.

### Quand recalculer

Recalculer après :

- modification du taux fiscal
- ajout ou suppression d'une variable
- correction de présence
- changement de fiche salarié ayant un impact paie

## 13. Étape 9 - Contrôler le détail de période

### Où aller

Ouvrir la période depuis **Périodes de paie**, puis cliquer sur la référence `PP-...`.

### Zones importantes

| Zone | Utilisation |
| --- | --- |
| **Devise de traitement / Devise fiscale** | vérification du contexte devise |
| **Statut** | état de la période |
| **Totaux période** | contrôle brut, net, charges et retenues |
| **Passifs paie à régler** | suivi des dettes salariés, sociales et fiscales |
| **Lettrage paie grand livre** | rapprochement des paiements |
| **Bulletins** | liste individuelle des bulletins |

### Contrôles recommandés

1. comparer le nombre de bulletins avec les salariés actifs
2. vérifier le **Brut total**
3. vérifier le **Net total**
4. contrôler **CNSS salarié**, **IPR**, **CNSS employeur**, **ONEM**, **INPP**
5. ouvrir quelques bulletins PDF en contrôle visuel

## 14. Étape 10 - Verrouiller, poster ou clôturer

### Boutons disponibles

| Bouton | Effet |
| --- | --- |
| **Verrouiller période** | passe la période de `OPEN` à `LOCKED` |
| **Poster** | génère le journal de paie sur une période `LOCKED` |
| **Déverrouiller** | revient à `OPEN` si la période n'est pas postée |
| **Clôturer et ouvrir suivante** | enchaîne clôture, posting si nécessaire et création du mois suivant |

### Contrôles bloquants

| Situation | Effet |
| --- | --- |
| aucun bulletin | clôture refusée |
| net total inférieur ou égal à zéro | clôture refusée |
| taux fiscal manquant si devise différente de `CDF` | clôture refusée |
| période non verrouillée pour posting manuel | posting refusé |

### Parcours conseillé

Pour l'exploitation mensuelle, utiliser **Clôturer et ouvrir suivante** après contrôle des bulletins. Ce bouton réduit les oublis car il crée directement la période suivante.

## 15. Étape 11 - Lire l'écriture de paie

Lors du posting, l'application génère un journal de paie équilibré.

### Schéma comptable synthétique

| Mouvement | Compte |
| --- | --- |
| Débit salaires de base | charges de rémunération |
| Débit primes | charges de primes |
| Débit charges patronales | charges sociales employeur |
| Crédit net à payer | dette envers personnel |
| Crédit CNSS | dette CNSS |
| Crédit ONEM | dette ONEM |
| Crédit INPP | dette INPP |
| Crédit IPR | dette fiscale |

### Comptes usuels

| Nature | Compte indicatif |
| --- | --- |
| Net à payer | `422000` |
| CNSS | `431300` |
| INPP | `433100` |
| ONEM | `433200` |
| IPR | `442100` |
| Avantages en nature | `661700` |

Les comptes exacts dépendent du mapping paie de la société.

## 16. Étape 12 - Régler le net salariés

### Où aller

Dans le détail d'une période `POSTED`, utiliser l'action **Régler net**.
Quand tous les passifs de paie sont couverts, la période passe automatiquement en `SETTLED`.

### Effet métier

Le passif **NET_PAY** diminue.

### Effet comptable

| Débit | Crédit |
| --- | --- |
| dette personnel | banque ou caisse |

### Contrôle

Après règlement, vérifier :

- **Réglé total**
- **Reste à régler**
- statut de règlement
- lettrage associé

## 17. Étape 13 - Régler les organismes et l'IPR

### Passifs concernés

| Code | Nature |
| --- | --- |
| **CNSS** | cotisations sociales |
| **ONEM** | contribution ONEM |
| **INPP** | contribution INPP |
| **IPR** | impôt professionnel |

### Action

Dans le tableau **Passifs par nature**, cliquer sur **Régler CNSS**, **Régler ONEM**, **Régler INPP** ou **Régler IPR** lorsque l'action est disponible.

### Effet comptable

| Débit | Crédit |
| --- | --- |
| dette organisme ou fiscale | banque ou caisse |

### Bon réflexe

Après chaque paiement organisme, lancer ou vérifier le **Lettrage paie**.

Pour une explication transversale des statuts `UNMATCHED`, `PARTIAL` et `MATCHED`, consulter : [Guide opératoire - Lettrage transversal](./lettering-user-guide.md).

## 18. Bulletins PDF

Chaque bulletin est accessible depuis la liste des bulletins de la période.

### Contenu attendu

| Bloc | Contenu |
| --- | --- |
| **Société** | identité de la société |
| **Période** | mois, année, référence |
| **Salarié** | matricule, nom, poste |
| **Devise** | devise de traitement, devise fiscale, taux |
| **Totaux** | brut, retenues, net |
| **Détail des lignes** | base, primes, retenues, charges |

### Contrôle visuel

Vérifier que :

- les accents sont visibles
- les montants sont alignés
- les blocs ne se chevauchent pas
- le taux fiscal affiché correspond à celui de la période

## 19. Exports disponibles

| Export | Utilisation |
| --- | --- |
| **Résumé JSON** | contrôle technique ou audit |
| **Résumé CSV** | reprise dans Excel |
| **Passifs CSV** | suivi des dettes à régler |
| **Résumé PDF** | dossier papier ou archivage |
| **Résumé XLSX** | analyse comptable détaillée |
| **Bulletin PDF** | remise ou archivage individuel |
| **Annual summary** | synthèse annuelle |
| **Trend** | évolution de la masse salariale et effectifs |

## 20. Tableau de bord Personnel

Le dashboard affiche des indicateurs RH :

- effectif total
- actifs
- embauches du mois
- sorties du mois
- embauches YTD
- sorties YTD
- turnover
- types de contrat
- ancienneté moyenne
- âge moyen
- brut moyen
- net moyen

Ces indicateurs servent au contrôle RH et à la revue de direction.

## 21. Incidents fréquents et résolution

| Message ou situation | Cause probable | Action |
| --- | --- | --- |
| **Aucune période OPEN** | aucune période ouverte | cliquer sur **Créer période courante** |
| génération impossible | taux fiscal manquant ou données paie incomplètes | saisir le taux, vérifier salariés et variables |
| clôture impossible : aucun bulletin | bulletins non générés | cliquer sur **Générer bulletins** |
| clôture impossible : net total <= 0 | paramètres ou données salariés incohérents | revoir salaires, retenues, variables |
| période en lecture seule | période `LOCKED`, `POSTED` ou `SETTLED` | déverrouiller si possible ou consulter seulement |
| audit indisponible | période `POSTED` ou `SETTLED` sans journal lié | réparer le statut ou régénérer selon procédure technique |
| organisme non réglable | flux de paiement non prêt ou passif nul | vérifier le résumé de période |

## 22. Check-list avant génération

Avant **Générer bulletins** :

1. salariés actifs vérifiés
2. entrées et sorties du mois traitées
3. postes et catégories cohérents
4. taux fiscal renseigné si nécessaire
5. présences saisies
6. heures supplémentaires saisies
7. variables contrôlées
8. centres de coûts renseignés si requis

## 23. Check-list avant clôture

Avant **Clôturer et ouvrir suivante** :

1. nombre de bulletins contrôlé
2. brut total contrôlé
3. net total contrôlé
4. CNSS salarié contrôlée
5. IPR contrôlé
6. CNSS employeur, ONEM et INPP contrôlés
7. bulletins PDF testés
8. résumé PDF ou XLSX exporté si besoin
9. aucune anomalie métier bloquante

## 24. Check-list après clôture

Après clôture :

1. période courante en `POSTED` ou `SETTLED`
2. période suivante créée en `OPEN`
3. journal de paie présent
4. passifs paie visibles
5. règlement net salariés effectué ou planifié
6. règlements CNSS/ONEM/INPP/IPR planifiés
7. lettrage paie contrôlé
8. dossier PDF/CSV/XLSX archivé

## 25. Captures prévues pour la version illustrée

Les captures à maintenir dans la documentation sont :

- écran **Gestion du Personnel**
- écran **Périodes de paie**
- écran **Gestion paie**
- écran **Saisies** d'une période
- écran **Détail période**
- exemple **Bulletin PDF**
- exemple **Résumé PDF période**

Emplacement prévu :

- `docs/assets/personnel-payroll-guide/personnel-overview.png`
- `docs/assets/personnel-payroll-guide/payroll-periods.png`
- `docs/assets/personnel-payroll-guide/payroll-run.png`
- `docs/assets/personnel-payroll-guide/payroll-inputs.png`
- `docs/assets/personnel-payroll-guide/payroll-period-detail.png`
- `docs/assets/personnel-payroll-guide/payslip-pdf.png`
- `docs/assets/personnel-payroll-guide/payroll-summary-pdf.png`

## 26. Références techniques

| Élément | Fichier |
| --- | --- |
| Gestion du Personnel | [src/app/employee/page.jsx](../src/app/employee/page.jsx) |
| Historique personnel | [src/app/employee-history/page.jsx](../src/app/employee-history/page.jsx) |
| Liste périodes de paie | [src/app/payroll/periods/page.jsx](../src/app/payroll/periods/page.jsx) |
| Détail période | [src/app/payroll/periods/[ref]/page.jsx](../src/app/payroll/periods/[ref]/page.jsx) |
| Saisies période | [src/app/payroll/periods/[ref]/inputs/page.jsx](../src/app/payroll/periods/[ref]/inputs/page.jsx) |
| Panneau de saisies | [src/app/payroll/periods/InputsPanel.jsx](../src/app/payroll/periods/InputsPanel.jsx) |
| Assistant génération paie | [src/app/payroll/run/RunWizard.jsx](../src/app/payroll/run/RunWizard.jsx) |
| Calcul paie | [src/lib/payroll/engine.js](../src/lib/payroll/engine.js) |
| Contexte devise paie | [src/lib/payroll/context.js](../src/lib/payroll/context.js) |
| Posting paie | [src/lib/payroll/postings.js](../src/lib/payroll/postings.js) |
| Clôture et période suivante | [src/app/api/payroll/period/[id]/close-and-next/route.js](../src/app/api/payroll/period/[id]/close-and-next/route.js) |
| PDF bulletin | [src/app/api/payroll/payslips/[id]/pdf/route.js](../src/app/api/payroll/payslips/[id]/pdf/route.js) |
| Guide validation paie | [docs/payroll-validation.md](./payroll-validation.md) |
