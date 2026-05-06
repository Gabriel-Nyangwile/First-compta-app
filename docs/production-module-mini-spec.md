# Mini cahier d'implémentation - Module Production / Fabrication

Ce document décrit une proposition concrète d'implémentation du module **Production** dans le projet `first-compta`.

Objectif : permettre à un service interne de demander la **fabrication** ou l'**assemblage** de composants déjà en stock pour obtenir un **nouveau produit fini**.

Le module est volontairement séparé des groupes **Achats** et **Ventes**.

## 1. Positionnement fonctionnel

### Groupe de menu recommandé

Créer un nouveau groupe :

- **Production**

### Sous-menus proposés

- `Vue générale production`
- `Ordres de fabrication`
- `Nomenclatures`
- `Déclarations de production`
- `Consommations matières`
- `Produits finis`

## 2. Cas métier couvert

Exemple :

- le magasin possède des matières ou pièces en stock
- un service interne demande l'assemblage ou la transformation
- l'entreprise consomme ces composants
- l'entreprise obtient un nouveau produit fini stockable

Exemples de scénarios :

- assemblage de pièces pour fabriquer un équipement
- transformation de matières premières en produit fini
- conditionnement de plusieurs articles en un nouveau produit

## 3. Flux métier cible

### 3.1. Préparer la nomenclature

Avant de lancer la production, l'utilisateur définit :

- le **produit fini**
- les **composants**
- les **quantités standard**
- éventuellement une **perte standard**
- éventuellement un **coût standard de main-d'oeuvre**

### 3.2. Créer un ordre de fabrication

L'utilisateur crée un **ordre de fabrication** avec :

- une référence `MOxxxxxx`
- le produit à fabriquer
- la quantité à produire
- le dépôt ou magasin source
- la date prévue
- une note de fabrication

Statut initial :

- `DRAFT`

### 3.3. Lancer l'ordre

Quand l'ordre est validé :

- le statut passe à `RELEASED`
- les composants deviennent réservables ou contrôlables

### 3.4. Consommer les composants

L'utilisateur enregistre les quantités réellement prélevées :

- sortie des matières/pièces du stock
- lien avec l'ordre de fabrication

Statut :

- `IN_PROGRESS`

### 3.5. Déclarer la production

L'utilisateur indique :

- la quantité produite
- la quantité rebutée ou perdue
- la date de fin

Le système :

- crée l'entrée du produit fini en stock
- garde la traçabilité des consommations

Statut :

- `COMPLETED`

### 3.6. Clôturer l'ordre

Quand tout est contrôlé :

- l'ordre passe à `CLOSED`

## 4. Statuts recommandés

### Ordre de fabrication

| Statut | Sens métier |
| --- | --- |
| `DRAFT` | ordre saisi mais non lancé |
| `RELEASED` | ordre autorisé, prêt à consommer |
| `IN_PROGRESS` | consommations ou déclarations en cours |
| `COMPLETED` | production terminée |
| `CLOSED` | ordre clôturé |
| `CANCELLED` | ordre annulé |

### Ligne de consommation

| Statut | Sens |
| --- | --- |
| `PLANNED` | prévu par nomenclature |
| `CONSUMED` | consommation enregistrée |
| `ADJUSTED` | ajustement manuel |

## 5. Modèles Prisma recommandés

### 5.1. `BillOfMaterial`

Décrit la nomenclature du produit fini.

Champs minimaux :

- `id`
- `companyId`
- `code`
- `label`
- `productId`
- `status`
- `version`
- `notes`
- `createdAt`
- `updatedAt`

### 5.2. `BillOfMaterialLine`

Décrit les composants.

Champs minimaux :

- `id`
- `companyId`
- `billOfMaterialId`
- `componentProductId`
- `quantity`
- `lossRate`
- `notes`

### 5.3. `ManufacturingOrder`

Ordre de fabrication principal.

Champs minimaux :

- `id`
- `companyId`
- `number`
- `status`
- `billOfMaterialId`
- `productId`
- `plannedQty`
- `producedQty`
- `scrapQty`
- `warehouseId` ou `storageLocationId`
- `plannedDate`
- `startedAt`
- `completedAt`
- `closedAt`
- `notes`
- `createdById`
- `createdAt`
- `updatedAt`

### 5.4. `ManufacturingOrderComponent`

Copie de travail des composants prévus pour un ordre donné.

Champs minimaux :

- `id`
- `companyId`
- `manufacturingOrderId`
- `productId`
- `plannedQty`
- `consumedQty`
- `varianceQty`
- `status`

### 5.5. `ManufacturingOutput`

Déclaration du produit fini.

Champs minimaux :

- `id`
- `companyId`
- `manufacturingOrderId`
- `productId`
- `quantity`
- `unitCost`
- `declaredAt`
- `notes`

## 6. Numérotation

Utiliser la mécanique existante `nextSequence(prisma, name, prefix, companyId)`.

Préfixes recommandés :

- `BOM-` pour les nomenclatures
- `MO-` pour les ordres de fabrication
- `MOC-` pour les consommations si un document séparé est souhaité
- `MOP-` pour les déclarations de production si un document séparé est souhaité

## 7. API à prévoir

### 7.1. Nomenclatures

- `GET /api/production/boms`
- `POST /api/production/boms`
- `GET /api/production/boms/[id]`
- `PUT /api/production/boms/[id]`
- `POST /api/production/boms/[id]/activate`
- `POST /api/production/boms/[id]/archive`

### 7.2. Ordres de fabrication

- `GET /api/production/orders`
- `POST /api/production/orders`
- `GET /api/production/orders/[id]`
- `PUT /api/production/orders/[id]`
- `POST /api/production/orders/[id]/release`
- `POST /api/production/orders/[id]/consume`
- `POST /api/production/orders/[id]/complete`
- `POST /api/production/orders/[id]/close`
- `POST /api/production/orders/[id]/cancel`

## 8. Écrans UI à prévoir

### 8.1. `/production`

Vue d'ensemble :

- ordres en brouillon
- ordres en cours
- ordres terminés
- quantité produite sur période
- consommations principales

### 8.2. `/production/boms`

Liste des nomenclatures :

- code
- produit fini
- version
- statut

### 8.3. `/production/boms/create`

Formulaire de création :

- produit fini
- composants
- quantités
- pertes

### 8.4. `/production/orders`

Liste des ordres :

- référence `MO`
- produit fini
- quantité prévue
- quantité produite
- statut
- date prévue

### 8.5. `/production/orders/[id]`

Écran principal métier, inspiré du guidage déjà engagé sur les BC :

- étape courante
- prochaine action
- composants à consommer
- quantités déjà consommées
- quantité finie déjà déclarée
- boutons directs

Boutons attendus :

- `Lancer l'ordre`
- `Consommer les composants`
- `Déclarer la production`
- `Clôturer`

## 9. UX recommandée

Le module doit être guidé par étapes, comme pour les bons de commande.

### Exemple de parcours affiché

1. ordre créé
2. ordre lancé
3. composants consommés
4. produit fini déclaré
5. ordre clôturé

### Messages utiles

- `Étape suivante : lancer l'ordre de fabrication`
- `Étape suivante : enregistrer la consommation des composants`
- `Étape suivante : déclarer la quantité produite`
- `Étape suivante : clôturer l'ordre`

## 10. Impact stock

### À la consommation

Créer des mouvements de stock `OUT` pour les composants.

### À la déclaration de production

Créer un mouvement de stock `IN` pour le produit fini.

### Remarque importante

La logique doit rester compatible avec la valorisation existante :

- stock des composants diminue
- stock du produit fini augmente
- cohérence avec CUMP à maintenir

## 11. Impact comptable

### Version simple recommandée pour Phase 1

Objectif : rester pragmatique sans lancer une usine à gaz analytique.

Proposition :

- consommation composants :
  - crédit compte de stock composant
  - débit compte `production en cours`

- entrée produit fini :
  - débit compte de stock produit fini
  - crédit compte `production en cours`

### Comptes à prévoir

- compte de stock des composants
- compte de stock du produit fini
- compte transitoire de production en cours

## 12. Intégration avec les produits existants

Le produit fini et les composants doivent réutiliser le catalogue `Product`.

Cela évite :

- un référentiel parallèle
- des doubles fiches
- des écarts de stock

Donc :

- un composant = un `Product`
- un produit fini = un `Product`

## 13. Règles de gestion minimales

### Règles Phase 1

- un ordre ne peut être lancé que s'il est en `DRAFT`
- un ordre ne peut consommer que s'il est en `RELEASED` ou `IN_PROGRESS`
- un ordre ne peut être clôturé que s'il est en `COMPLETED`
- la consommation ne peut pas dépasser le stock disponible sauf dérogation future
- une production ne peut pas être déclarée négative

### Règles utiles à venir

- autoriser la production partielle
- gérer les rebuts
- gérer les écarts de consommation
- gérer les substitutions de composants

## 14. Plan d'implémentation par phases

### Phase 1 - Socle production simple

À implémenter :

- menu `Production`
- nomenclatures simples
- ordres de fabrication
- consommation composants
- entrée produit fini
- statuts et guidage UX

Résultat attendu :

- on peut fabriquer un produit fini à partir du stock existant

### Phase 2 - Robustesse métier

À ajouter :

- production partielle
- rebuts
- ajustements de consommation
- PDF / impression d'ordre
- journal d'audit production

### Phase 3 - Enrichissement avancé

À ajouter :

- main-d'oeuvre
- centres de charge
- temps standards
- coûts de revient plus fins
- planification et capacité

## 15. Priorité recommandée dans le projet

Ce module est utile, mais il ne doit pas bloquer les chantiers de finalisation déjà identifiés.

Ordre conseillé :

1. finaliser les chantiers critiques de clôture projet
2. lancer ensuite la **Phase 1 du module Production**

## 16. Décision proposée

La proposition concrète est donc :

- créer un **nouveau groupe `Production`**
- démarrer avec une **Phase 1 simple et stockée**
- réutiliser les `Product`, les séquences, les mouvements de stock et le journal existants
- bâtir l'UX sur un **parcours guidé par étapes**

Ce module peut ensuite être étendu sans remettre en cause le socle.

## 17. Statut d'implémentation

Phase 1 introduite dans l'application :

- modèles Prisma `BillOfMaterial`, `BillOfMaterialLine`, `ManufacturingOrder`, `ManufacturingOrderComponent`, `ManufacturingOutput`
- séquences `BOM-` et `MO-`
- routes `/api/production/boms` et `/api/production/orders`
- écran `/production`
- écrans nomenclatures et ordres de fabrication
- consommation composants avec mouvements stock `OUT`
- déclaration produit fini avec mouvement stock `IN`
- écritures simples via compte de production en cours
- smoke `npm run test:production-flow`

Les enrichissements des phases 2 et 3 restent à traiter séparément.
