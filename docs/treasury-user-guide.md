# Guide opératoire - Trésorerie

Ce guide est destiné aux utilisateurs comptables et financiers qui travaillent au quotidien dans l'écran **Trésorerie**.

Il décrit le parcours réel de l'application, avec le vocabulaire vu à l'écran, les contrôles bloquants et la lecture comptable associée.

## 1. À quoi sert l'écran Trésorerie

L'écran **Trésorerie** sert à :

- suivre le **solde global**
- consulter les **comptes** de banque et de caisse
- enregistrer une **opération de trésorerie**
- faire un **transfert interne**
- créer un **compte de trésorerie**
- **régulariser un dossier d'avance de mission**
- **enregistrer le remboursement d'un reliquat**
- contrôler les **avances de mission ouvertes**
- consulter le **grand livre trésorerie**

En pratique, c'est l'écran de saisie et de contrôle des flux de banque et de caisse.

## 2. Vocabulaire utilisateur

| Terme affiché | Sens métier |
| --- | --- |
| **Compte trésorerie** | banque ou caisse utilisée pour le règlement |
| **Saisir une opération de trésorerie** | saisie d'une entrée ou d'une sortie |
| **Sens** | encaissement ou décaissement |
| **Nature** | type d'opération saisi |
| **Compte contrepartie** | compte général qui reçoit l'autre côté de l'écriture |
| **Réf pièce** | référence automatique du mouvement |
| **Grand livre trésorerie** | détail chronologique des mouvements d'un compte |
| **Vue générale trésorerie** | écran principal des soldes, comptes et opérations |
| **Autorisations de trésorerie** | écran de suivi global des autorisations caisse et banque |
| **Décaissements caisse** | paiements et sorties de caisse |
| **Encaissements caisse** | recettes et entrées de caisse |
| **Décaissements banque** | paiements et sorties bancaires |
| **Encaissements banque** | recettes et entrées bancaires |
| **Règlements fournisseurs** | suivi par fournisseur des factures à régler et des règlements saisis |
| **Avances de mission ouvertes** | avances non encore totalement justifiées ou remboursées |
| **Rapprochement / lettrage** | contrôle entre le paiement et la dette fournisseur |
| **Transferts internes** | transferts entre caisses et banques |
| **Compte de règlement** | compte de caisse ou de banque utilisé pour l'opération |
| **Dossier d'avance** | référence d'une avance de mission encore en cours de traitement |

## 3. Vue d'ensemble du parcours

| Étape | Action utilisateur | Résultat attendu |
| --- | --- | --- |
| 1 | créer les comptes de banque et de caisse | les comptes apparaissent dans les listes |
| 2 | saisir les mouvements de caisse ou de banque | le solde du compte est mis à jour |
| 3 | payer les fournisseurs | l'encours fournisseur diminue |
| 4 | traiter les avances de mission | le reliquat est suivi jusqu'à extinction |
| 5 | contrôler le grand livre et les alertes | les anomalies sont identifiées avant clôture |

## 4. Repères visuels dans l'écran

Quand vous ouvrez `/treasury`, vous retrouvez généralement ces zones :

| Zone | Ce qu'elle permet de faire |
| --- | --- |
| **Solde global** | voir immédiatement la position de trésorerie |
| **Comptes** | vérifier le solde par banque ou par caisse |
| **Saisir une opération de trésorerie** | saisir un encaissement ou un décaissement |
| **Transfert interne** | passer des fonds d'un compte à un autre |
| **Créer un compte de trésorerie** | créer une nouvelle banque ou une nouvelle caisse |
| **Régulariser un dossier d'avance de mission** | imputer des dépenses justifiées |
| **Enregistrer le remboursement d'un reliquat** | constater le retour du reliquat |
| **Avances de mission ouvertes** | suivre les dossiers non soldés |
| **Grand livre trésorerie** | auditer un compte mouvement par mouvement |

Depuis la navigation du module, vous retrouvez aussi les accès directs suivants :

- **Vue générale trésorerie**
- **Autorisations de trésorerie**
- **Décaissements caisse**
- **Encaissements caisse**
- **Décaissements banque**
- **Encaissements banque**
- **Règlements fournisseurs**
- **Avis bancaires**
- **Transferts internes**

## 5. Étape 1 - Créer un compte de banque ou de caisse

### Où aller

Dans le bloc **Créer un compte de trésorerie**.

### Ce qu'il faut saisir

| Champ écran | Attendu |
| --- | --- |
| **Type** | `Banque (521xxx)` ou `Caisse (571xxx)` |
| **Libellé** | nom opérationnel du compte |
| **Code interne** | repère interne facultatif |
| **Devise** | devise du compte |
| **Solde d'ouverture** | solde de départ |

### Ce que fait l'application

| Action | Effet |
| --- | --- |
| création d'un compte banque | création automatique d'un compte comptable `521xxx` |
| création d'un compte caisse | création automatique d'un compte comptable `571xxx` |

### Conseil terrain

Utiliser un libellé directement reconnaissable par l'équipe, par exemple :

- `Banque principale`
- `Caisse agence`
- `Banque USD`

## 6. Étape 2 - Saisir un mouvement dans le bloc "Saisir une opération de trésorerie"

### Finalité

Enregistrer une entrée ou une sortie d'argent.

### Champs les plus importants

| Champ écran | Rôle |
| --- | --- |
| **Compte trésorerie** | compte impacté |
| **Compte de règlement sélectionné** | compte effectivement retenu pour l'opération |
| **Sens** | entrée ou sortie |
| **Nature** | type d'opération |
| **Montant** | montant encaissé ou décaissé |
| **Description** | libellé visible dans le grand livre |
| **Compte contrepartie** | compte général de l'autre côté |
| **Pièce / justificatif** | référence libre du document |
| **Bénéficiaire libre** | nom porté sur la pièce, si pas d'employé sélectionné |

### Contrôles intégrés

| Contrôle | Conséquence |
| --- | --- |
| montant inférieur ou égal à zéro | refus de la saisie |
| nature incohérente avec le sens | refus de la saisie |
| compte contrepartie manquant alors qu'il est requis | refus de la saisie |
| décaissement de caisse amenant un solde négatif | alerte puis blocage |
| nature mission sans employé | refus de la saisie |

### Traduction des natures affichées

| Libellé vu à l'écran | Signification opératoire |
| --- | --- |
| **Autre** | mouvement libre avec contrepartie manuelle |
| **Encaissement client** | règlement reçu d'un client |
| **Paiement fournisseur** | règlement d'une facture fournisseur |
| **Achat cash** | achat payé immédiatement |
| **Frais employé remboursés** | remboursement d'une dépense déjà supportée par un salarié |
| **Avance de mission** | fonds avancés à un salarié avant sa mission |
| **Sortie de caisse** | petite sortie sans cycle fournisseur |
| **Paiement TVA** | règlement d'une dette TVA |
| **Paiement taxe** | règlement d'une dette fiscale ou parafiscale |
| **Apport associé** | apport en trésorerie par un associé |
| **Remboursement associé** | sortie au profit d'un associé |
| **Paiement salaires** | paiement d'un montant dû au personnel |
| **Avance salaire** | avance versée avant paie définitive |

## 7. Cas le plus fréquent - Payer un fournisseur

### Parcours conseillé

Le plus pratique n'est pas toujours de partir du bloc **Saisir une opération de trésorerie**. Pour les règlements fournisseurs, le bon parcours est souvent :

1. ouvrir **Règlements fournisseurs** via `/treasury/suppliers`
2. repérer le fournisseur concerné
3. cliquer sur **Enregistrer un paiement**
4. laisser l'application préremplir la facture ciblée dans l'écran Trésorerie

### Ce que voit l'utilisateur

Dans **Règlements fournisseurs**, on suit :

- l'**encours total**
- les **fournisseurs en retard**
- les **factures à régler**
- les **derniers paiements saisis**

### Résultat comptable

| Débit | Crédit |
| --- | --- |
| compte fournisseur | compte de trésorerie |

### Bon réflexe

Après saisie, vérifier :

- que la facture a bien diminué en **restant dû**
- que le paiement n'apparaît pas en anomalie de **rapprochement**

## 8. Cas le plus fréquent - Encaisser un client

### Comment faire

Dans **Saisir une opération de trésorerie** :

1. choisir la nature **Encaissement client**
2. rechercher la facture
3. vérifier le montant prérempli
4. valider la saisie

### Résultat comptable

| Débit | Crédit |
| --- | --- |
| compte de trésorerie | compte client |

### Point pratique

Le montant proposé correspond au **reste à encaisser**. Il faut le contrôler avant validation si le règlement est partiel.

## 9. Cas le plus fréquent - Enregistrer un achat cash

### Quand utiliser ce flux

Quand l'achat est payé immédiatement, sans passer par un cycle fournisseur à régler plus tard.

### Dans l'écran

Utiliser la nature **Achat cash**.

### Saisie attendue

| Champ écran | Attendu |
| --- | --- |
| **Montant HT** | base hors taxe |
| **Taux TVA** | taux applicable |
| **Description** | libellé de l'achat |
| **Compte contrepartie** | charge concernée |

### Résultat comptable

| Cas | Écriture |
| --- | --- |
| sans TVA ventilée | Dr charge ; Cr trésorerie |
| avec TVA | Dr charge ; Dr `445660` ; Cr trésorerie |

## 10. Cas sensible - Avance de mission

### Logique métier

Une avance de mission se traite en trois temps :

1. **sortie initiale**
2. **régularisation des frais**
3. **remboursement éventuel du reliquat**

### 10.1 Saisir l'avance initiale

Dans **Saisir une opération de trésorerie** :

- choisir **Avance de mission**
- sélectionner l'employé
- renseigner la pièce
- utiliser un compte de classe 4 de type avance à justifier

### Écriture

| Débit | Crédit |
| --- | --- |
| compte d'avance salarié `425/467` | compte de trésorerie |

### 10.2 Régulariser l'avance

Dans le bloc **Régulariser un dossier d'avance de mission** :

- rechercher l'employé
- choisir le dossier d'avance ouvert
- renseigner le **compte de charge**
- saisir le **montant à imputer**

### Écriture

| Débit | Crédit |
| --- | --- |
| compte de charge `6xxxx` | compte d'avance de l'avance initiale |

### 10.3 Enregistrer le remboursement du reliquat

Dans le bloc **Enregistrer le remboursement d'un reliquat** :

- rechercher l'employé
- sélectionner le dossier d'avance ouvert
- choisir le **compte d'encaissement**
- saisir le **montant remboursé**

### Écriture

| Débit | Crédit |
| --- | --- |
| compte de trésorerie | compte d'avance de l'avance initiale |

### Signal de contrôle

Le tableau **Avances de mission ouvertes** doit diminuer puis disparaître quand l'avance est soldée.

## 11. Cas simple - Transfert entre caisse et banque

### Où aller

Dans le bloc **Saisir un transfert interne**.

### Saisie attendue

| Champ écran | Attendu |
| --- | --- |
| **De** | compte source |
| **Vers** | compte de destination |
| **Montant** | montant transféré |
| **Description** | libellé du transfert |

### Résultat comptable

| Débit | Crédit |
| --- | --- |
| compte de destination | compte source |

### Ce qu'il faut contrôler

Deux mouvements sont créés :

- une sortie sur le compte source
- une entrée sur le compte de destination

## 12. Comment lire le grand livre trésorerie

Le **Grand livre trésorerie** sert au contrôle.

### Ce qu'il affiche

| Zone | Lecture |
| --- | --- |
| **Ouverture** | solde de départ sur la période |
| **Entrées** | total encaissé |
| **Sorties** | total décaissé |
| **Clôture** | solde à la fin de la période |
| **Nature** | type d'opération |
| **Tiers / pièce** | facture, employé, fournisseur ou justificatif |
| **Réf** | référence du mouvement |
| **Compte (Débit)** | contrepartie débit |
| **Compte (Crédit)** | contrepartie crédit |
| **Solde après** | solde juste après l'opération |

### Utilisation terrain

Le grand livre sert notamment à :

- retrouver une pièce
- expliquer un solde de banque ou de caisse
- vérifier le bon compte de contrepartie
- justifier un mouvement auprès du contrôle interne

## 13. Alertes à surveiller en priorité

| Indicateur | Lecture métier |
| --- | --- |
| **caisse négative** | anomalie immédiate à traiter |
| **paiement fournisseur à rapprocher** | règlement saisi mais non totalement lettré |
| **avance de mission ouverte** | dossier non soldé |
| **avance critique > 90 jours** | dossier ancien à relancer |

Ces alertes remontent dans :

- la page **Trésorerie**
- l'API `/api/treasury/summary`
- le dashboard

Pour comprendre précisément ce que signifie **lettré**, **non lettré** ou **partiellement lettré**, consulter le guide transversal : [Guide opératoire - Lettrage transversal](./lettering-user-guide.md).

## 14. Check-list de fin de période

Avant une clôture mensuelle ou une revue de caisse, vérifier au minimum :

1. qu'aucune **caisse** n'est négative
2. que les **paiements fournisseurs** importants sont rapprochés
3. que les **avances de mission ouvertes** sont justifiées ou relancées
4. que les mouvements sensibles portent une **pièce / justificatif**
5. que le **grand livre trésorerie** est cohérent avec les soldes attendus

## 15. Conseils d'exploitation

| Conseil | Pourquoi |
| --- | --- |
| utiliser la vue **Règlements fournisseurs** pour les règlements | elle donne immédiatement l'encours et les retards |
| ne pas utiliser **Autre** si un flux dédié existe | le suivi sera meilleur |
| renseigner la **description** avec un libellé métier clair | le grand livre sera plus lisible |
| renseigner la **pièce / justificatif** sur les sorties sensibles | facilite l'audit |
| traiter vite les avances anciennes | évite les reliquats oubliés |
| contrôler le **solde après** dans le grand livre pour les caisses | permet de repérer rapidement une anomalie |

## 16. Captures prévues pour la version illustrée

L'environnement local permet de préparer la structure du guide illustré. Les captures à maintenir dans cette documentation sont :

- vue **Vue générale trésorerie** de `/treasury`
- vue `/treasury/suppliers`
- vue détail `/suppliers/[id]/treasury`

Emplacement prévu :

- `docs/assets/treasury-guide/treasury-overview.png`
- `docs/assets/treasury-guide/treasury-suppliers.png`
- `docs/assets/treasury-guide/treasury-supplier-detail.png`

## 17. Références techniques

| Élément | Fichier |
| --- | --- |
| Page Trésorerie | [src/app/treasury/page.jsx](../src/app/treasury/page.jsx) |
| Vue Paiements fournisseurs | [src/app/treasury/suppliers/page.jsx](../src/app/treasury/suppliers/page.jsx) |
| Détail trésorerie fournisseur | [src/app/suppliers/[id]/treasury/page.jsx](../src/app/suppliers/[id]/treasury/page.jsx) |
| Formulaire Saisir une opération de trésorerie | [src/components/treasury/NewMoneyMovementForm.jsx](../src/components/treasury/NewMoneyMovementForm.jsx) |
| Formulaire Transfert interne | [src/components/treasury/TransferForm.jsx](../src/components/treasury/TransferForm.jsx) |
| Formulaire Créer un compte de trésorerie | [src/components/treasury/NewMoneyAccountForm.jsx](../src/components/treasury/NewMoneyAccountForm.jsx) |
| Formulaire Régulariser un dossier d'avance de mission | [src/components/treasury/MissionAdvanceRegularizationForm.jsx](../src/components/treasury/MissionAdvanceRegularizationForm.jsx) |
| Formulaire Enregistrer le remboursement d'un reliquat | [src/components/treasury/MissionAdvanceRefundForm.jsx](../src/components/treasury/MissionAdvanceRefundForm.jsx) |
| Panneau Avances de mission ouvertes | [src/components/treasury/MissionAdvanceOpenPanel.jsx](../src/components/treasury/MissionAdvanceOpenPanel.jsx) |
