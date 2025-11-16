# Feuille de Route Paie & Comptabilité (OHADA)

## 1. Objectifs
Mettre en place un module Paie intégré au noyau comptable existant (journal en partie double, séquences, PDF, contrôles d'intégrité) permettant :
- Gestion des périodes de paie (mensuelle initialement).
- Génération de bulletins (payslips) avec lignes détaillées : salaire de base, primes, retenues, cotisations, impôts.
- Calcul automatisé des charges salariales et patronales selon règles fournies (barèmes, taux, plafonds, tranches).
- Production d'écritures comptables OHADA cohérentes et lettrables (Σ Débit = Σ Crédit) via `finalizeBatchToJournal`.
- Affectation analytique (centre de coût) pour ventilation des charges.
- Traçabilité, auditabilité et verrouillage après clôture de période.
- Génération PDF cohérente avec pipeline existante (watermark BROUILLON avant clôture).

## 2. Périmètre Initial vs Extensions
Périmètre v1:
- Périodes de paie, bulletins, lignes, barèmes de retenue simple, cotisations à taux fixe.
- Comptabilisation standard : salaires, cotisations salariales & patronales, IR / retenue à la source, net à payer, banque lors du paiement.
- Centres de coût et répartition par pourcentage sur salaire de base + charges patronales.

Extensions futures (v2+):
- Congés payés (provision + consommation), indemnités de fin de contrat.
- Avances & prêts salariés, régularisation rétroactive.
- Multi‑pays / multi‑devises.
- Intégration DSN / déclarations sociales locales.

## 3. Concepts Domaine
- PayrollPeriod: Fenêtre temporelle (mois, année), statut (OPEN, LOCKED, POSTED).
- Payslip: Bulletin individuel pour un employé et une période.
- PayslipLine: Ligne typée (BASE, PRIME, RETENUE, COTISATION_SALARIALE, COTISATION_PATRONALE, IMPOT, AJUSTEMENT).
- PayrollItem / Rule: Définition paramétrable (code, libellé, formule / taux / barème).
- ContributionScheme: Schéma de cotisation (employé %, employeur %, plafond, assiette).
- TaxRule: Barème progressif (tranches, taux, décote éventuelle) ou forfait.
- CostCenter: Centre analytique (code, libellé).
- EmployeeCostAllocation: Pourcentage(s) de ventilation par centre de coût.

## 4. Modèle de Données (proposition Prisma)
Ajouter au `prisma/schema.prisma` (simplifié, enums à préciser) :
```prisma
model PayrollPeriod {
  id            String   @id @default(cuid())
  ref           String   @unique // sequence PP-######
  month         Int
  year          Int
  status        PayrollPeriodStatus @default(OPEN)
  openedAt      DateTime @default(now())
  lockedAt      DateTime?
  postedAt      DateTime?
  payslips      Payslip[]
}

model Payslip {
  id          String   @id @default(cuid())
  ref         String   @unique // sequence PSL-######
  employeeId  String
  employee    Employee @relation(fields:[employeeId], references:[id])
  periodId    String
  period      PayrollPeriod @relation(fields:[periodId], references:[id])
  lines       PayslipLine[]
  grossAmount Decimal @default(0)
  netAmount   Decimal @default(0)
  locked      Boolean @default(false)
  costCenterAllocations PayslipCostAllocation[]
}

model PayslipLine {
  id          String   @id @default(cuid())
  payslipId   String
  payslip     Payslip @relation(fields:[payslipId], references:[id])
  kind        PayslipLineKind
  code        String // ex: BASE, PRIM_RCP, CNSS_EMP
  label       String
  amount      Decimal
  baseAmount  Decimal? // assiette calcul
  meta        Json?
  order       Int
}

model ContributionScheme {
  id          String @id @default(cuid())
  code        String @unique
  label       String
  employeeRate Decimal // % (0-1)
  employerRate Decimal // % (0-1)
  ceiling     Decimal? // Plafond assiette
  baseKind    ContributionBaseKind // BASE_SALAIRE, BRUT, etc.
  active      Boolean @default(true)
}

model TaxRule {
  id        String @id @default(cuid())
  code      String @unique
  label     String
  brackets  Json // [{max:null|number, rate:Decimal, deduction?:Decimal}]
  roundingMode TaxRoundingMode @default(BANKERS)
  active    Boolean @default(true)
}

model CostCenter {
  id     String @id @default(cuid())
  code   String @unique
  label  String
  active Boolean @default(true)
}

model EmployeeCostAllocation {
  id          String @id @default(cuid())
  employeeId  String
  employee    Employee @relation(fields:[employeeId], references:[id])
  costCenterId String
  costCenter   CostCenter @relation(fields:[costCenterId], references:[id])
  percent     Decimal // 0-1; total par employé = 1
}

model PayslipCostAllocation {
  id           String @id @default(cuid())
  payslipId    String
  payslip      Payslip @relation(fields:[payslipId], references:[id])
  costCenterId String
  costCenter   CostCenter @relation(fields:[costCenterId], references:[id])
  percent      Decimal // Copie snapshot au moment génération
  amount       Decimal  // Montant imputé (calculé)
}

enum PayrollPeriodStatus { OPEN LOCKED POSTED }
enum PayslipLineKind { BASE PRIME RETENUE COTISATION_SALARIALE COTISATION_PATRONALE IMPOT AJUSTEMENT }
enum ContributionBaseKind { BASE_SALAIRE BRUT IMPOSABLE }
enum TaxRoundingMode { NONE BANKERS UP DOWN }
```
Notes:
- Snapshot allocations pour traçabilité.
- Ne pas stocker OVERDUE; statut dérivé par date de période vs verrouillage.

## 5. Séquences & Identifiants
Utiliser `nextSequence(prisma, name, prefix)` :
- PayrollPeriod: `PP-######`
- Payslip: `PSL-######`
- Batch de paie (journal global mensuel): `PAY-######` (si on regroupe les écritures de paie d'un mois avant paiement banque).

## 6. Moteur de Calcul
Pipeline (pure functions, déterministe, pas d’E/S direct):
1. Collecte des données d'entrée (salaire de base, primes déclarées, allocations, schémas de cotisation actifs, règles fiscales).
2. Construction de l'assiette BRUT = base + primes (avant retenues).
3. Application des ContributionScheme (assiette = baseKind -> map vers BASE_SALAIRE ou BRUT). Plafond: `min(assiette, ceiling)`.
4. Calcul des cotisations salariales (retenues) et patronales (charges) -> lignes séparées.
5. Calcul IR / impôt via barème (brackets triées). Parcours cumulatif, application taux, déduction éventuelle.
6. Net à payer = BRUT - retenues (cotisations salariales + impôts) + ajustements.
7. Agrégation des montants pour: grossAmount, netAmount.
8. Allocation analytique: distribution du salaire de base + charges patronales vers PayslipCostAllocation (montants arrondis, ajustement final sur la dernière ligne pour somme exacte).

Règles:
- Rounding: central util `roundMoney(value, mode)` (mode issu TaxRule ou global). Utiliser Decimal puis conversion `toNumber()` en sortie JSON.
- Meta JSON sur lignes pour tracer calcul (assiette, taux, tranche).
- Idempotence: recalcul écrase lignes générées sauf ajustements manuels (kind AJUSTEMENT) marqués `meta.manual=true`.

## 7. Mapping Comptable OHADA (Postings)
Paramétrable via table de configuration (ex: `PayrollAccountMapping`) ou extension de `systemAccounts`. Valeurs par défaut indicatives (à CONFIRMER avec votre plan OHADA exact):

| Rôle | Compte OHADA (exemples) | Commentaire |
|------|--------------------------|-------------|
| Charges de salaires (brut) | 6411 | Salaires et appointements |
| Charges patronales (employeur) | 6451 | Charges de sécurité sociale |
| Dettes sociales – part salariale | 431 / 437 | Organismes sociaux (part salarié) |
| Dettes sociales – part patronale | 431 / 437 | Organismes sociaux (part employeur) |
| Impôt sur salaires retenu | 444 ou 442 | État – Impôts retenus à la source |
| Rémunérations dues | 421 | Personnel – Rémunérations dues |
| Banque | 512 | Banque |

Écritures type (journal de paie, génération lorsque période LOCKED):
1) Comptabilisation du brut et des retenues (part salariale + impôt):
- Débit 6411 Salaire brut
- Crédit 431/437 Cotisations salariales
- Crédit 444/442 Impôts retenus
- Crédit 421 Net à payer

2) Comptabilisation des charges patronales:
- Débit 6451 Charges patronales
- Crédit 431/437 Cotisations patronales

3) Règlement du net au salarié (script `payroll-settlement`):
- Débit 421 Rémunérations dues
- Crédit 512 Banque

Exemple chiffré (à titre illustratif): BRUT = 1 000 000, Cotis salariales = 40 000, Impôt = 50 000, Net = 910 000, Charges patronales = 120 000
- Écriture 1: DR 6411 1 000 000 ; CR 431 40 000 ; CR 444 50 000 ; CR 421 910 000
- Écriture 2: DR 6451 120 000 ; CR 431 120 000
- Écriture 3 (paiement): DR 421 910 000 ; CR 512 910 000

Ces comptes seront fournis par configuration et injectés lors de la génération des Transactions. Aucune valeur codée en dur.

Lettrage:
- Liaison Payslip -> JournalEntry via voucherRef = ref payslip ou batch.
- Paiement banque lettré contre 421x.

### 7.1 RDC – Schémas d'écritures détaillés (SYSCOHADA)
Basé sur la pratique en RDC (référence SYSCOHADA), les écritures sont scindées en trois temps. Les sous‑comptes exacts (661x/662x/664x/421/422/431/433/442/427/512/57/78/6617) sont paramétrables via `PayrollAccountMapping`.

1) Enregistrement de la paie du Salaire Brut au Net (sur base du livre de paie mensuel)
- Débit 661/662 Rémunérations directes du personnel (total Salaire Brut: salaire de base + primes + AEN)
- Crédit 431 Organismes sociaux (part salariale CNSS)
- Crédit 442 État – IPR retenu à la source
- Crédit 427 Personnel – Oppositions/avances (autres retenues, le cas échéant)
- Crédit 422 Personnel – Rémunérations dues (Salaire Net à payer)

2) Enregistrement des charges patronales (cotisations employeur)
- Débit 664 Charges sociales sur rémunération du personnel
- Crédit 431 CNSS – part patronale
- Crédit 433 Autres organismes sociaux – INPP (part patronale)
- Crédit 433 Autres organismes sociaux – ONEM (part patronale)

3) Paiements (règlements des dettes)
- Débit 422 Personnel – Rémunérations dues / Crédit 512 Banque (ou 57 Caisse) pour le Net payé
- Débit 431/433 / Crédit 512 (ou 57) pour CNSS/INPP/ONEM (parts salariales + patronales)
- Débit 442 / Crédit 512 (ou 57) pour l’IPR reversé

Avantages en nature (AEN)
- Intégration au brut: inclus dans 661/662 au point (1) ; contrepartie crédit 421 (comme une avance théorique) pour neutraliser le non‑versement en espèces
- Transfert de charges: Débit 6617 « Avantages en nature » / Crédit 78 « Transferts de charges » afin de reclasser la charge initiale de l’AEN déjà comptabilisée ailleurs (ex. loyer)

Remarques
- Les comptes présentés sont indicatifs; l’application n’en durcit aucun et s’appuie exclusivement sur la configuration.
- Les écritures 1 et 2 sont générées au LOCK de la période; les paiements sont gérés par un endpoint dédié (cf. §10) qui lettrent les comptes 422/431/433/442 contre la banque.

### 7.2 RDC – Mapping de comptes fourni (numéros exacts)
Un mapping d’entreprise a été ajouté dans `src/data/rdc-payroll-accounts.json` avec les numéros suivants:
- 661100, 661200, 662100, 662200 (rémunérations) • 664100, 664200 (charges patronales)
- 422000 (net à payer) • 427100/427200 (oppositions/avances) • 431300 (CNSS) • 433100 (INPP) • 433200 (ONEM)
- 442100 (IPR) • 661700 (AEN) • 781000 (Transferts de charges)

Banques/Caisse: ne pas utiliser 512xxx; utiliser 521xxx (banques) et 57xxxx (caisse) – fournis par le module Treasury.

## 8. Intégration Journal
- Générer toutes les `Transaction` pour une période (loop sur payslips agrégés) dans une transaction Prisma.
- Appeler `finalizeBatchToJournal` avec un voucherRef `PAY-######`.
- Validation invariants: Σ Débit == Σ Crédit sinon rollback.
- Injection comptes: résolution via `PayrollAccountMapping` ou `getSystemAccounts()` étendu (sans dupliquer la logique TVA existante).
- Stocker `costCenterId` (ou `costCenters[]`) dans `Transaction.meta` pour analyses BI; option: colonne dédiée si volumétrie élevée.

`PayrollAccountMapping` (proposition):
```
model PayrollAccountMapping {
  id           String @id @default(cuid())
  code         String @unique // e.g. WAGES, EMPLOYER_CONTRIB, EMPLOYEE_CONTRIB, PAYE_TAX, NET_PAY, BANK
  accountId    String? // FK vers Ledger Account si vous mappez par id
  accountNumber String? // ou mapping par numéro OHADA
  label        String
  active       Boolean @default(true)
}
```

Codes usuels recommandés (extensibles):
- WAGES (661/662), EMPLOYER_CONTRIB (664), EMPLOYEE_CONTRIB (431-sal), EMPLOYER_CONTRIB_CNSS (431‑pat), EMPLOYER_CONTRIB_INPP (433‑INPP), EMPLOYER_CONTRIB_ONEM (433‑ONEM)
- PAYE_TAX (442), NET_PAY (422), EMPLOYEE_ADVANCE (427), BANK (512), CASH (57), BENEFIT_IN_KIND (6617), TRANSFER_REVENUE (78)

## 9. Affectation Analytique
- EmployeeCostAllocation définit la ventilation de base.
- Au calcul payslip créer PayslipCostAllocation snapshot.
- Montant imputé par centre = (Salaire base + charges patronales sélectionnées) * percent.
- Postings: créer Transactions séparées par centre (débit sur compte 64x analytique) OU un champ costCenterId pour filtre reporting (choisir stratégie : multi transactions recommandé pour granularité).

## 10. API REST (Next.js App Router)
Routes:
- `POST /api/payroll/period` (créer période OPEN)
- `POST /api/payroll/period/{id}/generate` (générer payslips automatiques)
- `POST /api/payroll/period/{id}/lock` (verrouiller, recalcul final, générer journal paie)
- `POST /api/payroll/period/{id}/unlock` (si aucun journal généré, contrôle permissions)
- `GET /api/payroll/period/{id}` (détails + payslips)
- `POST /api/payslip/{id}/recalculate` (réinitialiser lignes hors AJUSTEMENT)
- `POST /api/payslip/{id}/adjust` (ajout ligne AJUSTEMENT)
- `POST /api/payslip/{id}/pdf` (génération PDF via pipeline existante)
- `POST /api/payroll/settlement` (paiement net global ou par employé)

Notes RDC:
- Le règlement CNSS/INPP/ONEM et IPR peut être regroupé par organisme et période; l’API doit agréger les soldes par compte tiers (431/433/442) et générer une écriture par organisme.

## 11. Génération PDF
- Réutiliser générateur multi-pages existant.
- Template payslip: entête société (ENV), identifiants employé, période, récap lignes (columns: Code, Libellé, Base, Taux, Montant).
- Watermark BROUILLON si période OPEN.
- Script smoke: `smoke-payroll-pdf.js` cherche `%PDF-` dans sortie.

## 12. Sécurité & Audit
- Période LOCKED rend payslips en lecture seule (sauf AJUSTEMENT contrôlé).
- Journal POSTED => immuable; modification exige script `payroll-reverse.js` (écritures d'inversion).
- Traçabilité: meta sur payslip lines inclut timestamp calcul et source règle (ruleId, schemeId).

## 13. Tests & Scripts
Scripts à ajouter (idempotents):
- `test-payroll-calculation.js` (jeux de données salariés + assertions sur net).
- `test-payroll-journal-integrity.js` (vérifie équilibre et comptes utilisés).
- `audit-payroll-balances.js` (compare 64x vs somme lignes payslip).
- `smoke-payroll-pdf.js`.
- `backfill-payroll-voucher-refs.js` (si ajout après coup).

Jeux de tests RDC (à prévoir):
- Barème IPR progressif aux seuils de tranche (frontière) + application du minimum légal mensuel et du plafond « impôt ≤ 30% du RI ».
- Plafond CNSS (assiette limitée) et taux variables de risques professionnels (0–4%).
- ONEM 0,5% (employeur seul), INPP selon taille (3/2/1%).
- AEN: inclusion dans le brut, contrepartie 421, transfert 6617/78.

Tests unit (Jest ou existant):
- Utilitaires: bracket calculation, rounding, allocation sum.
- Edge cases: plafond atteint, net négatif prévention, tranches frontières.

## 14. Phases d'Implémentation
Phase 1 (Infra & Modèles): Prisma migrations (period, payslip, lines, cost centers, schemes, tax rule), sequences, CRUD basique.
Phase 2 (Calcul): Engine (gross, contributions, tax), recalcul endpoint, tests unit.
Phase 3 (Journal): Génération postings, finalizeBatchToJournal, script test intégrité.
Phase 4 (Allocation Analytique): Ventilation centre coût + transactions multi-centre.
Phase 5 (PDF): Template payslip + smoke script.
Phase 6 (Sécurité & Lock): Lock/unlock workflow, settlement paiement.
Phase 7 (Audits & Backfill): Scripts audit & backfills, optimisation performance.

## 15. Inputs Requis (à fournir par vous)
- Barèmes fiscaux: structure des tranches (plafond, taux, déduction). Exemple JSON.
- Taux cotisations: employé/employeur, assiette, plafonds.
- Comptes OHADA exacts (n°) pour mapping (64x sous‑comptes, 421, 431, 437, 442, 52x...).
- Règles de rounding officielles (bankers vs arithmétique vs supérieur). 
- Politique d'ajustement allocation (arrondir à la centime ou fcfa?).

Spécifiques RDC supplémentaires:
- Paramètres IPR: barème annuel en CDF, abattement « frais professionnels » (ex. 25% paramétrable), minimum mensuel (ex. 2 500 CDF) et plafond « impôt ≤ 30% du RI ».
- Plafond CNSS (assiette mensuelle, ex. 1 500 000 CDF – paramétrable), taux salarié 5%, taux employeur 5% + risque pro 0–4%.
- ONEM 0,5% (employeur), INPP 3/2/1% selon taille (seuils à préciser et paramétrer).
- FX: taux de change CDF↔EUR à la date de fin de période (source à préciser), conversion avant calcul IPR, reconversion vers EUR pour la comptabilisation.

Fichiers de configuration ajoutés (RDC):
- `src/data/rdc-taxrule-ipr.json` – barème IPR fourni (annuel en CDF) + règles de minimum/plafond
- `src/data/rdc-contribution-schemes.json` – CNSS (5%/5% base RI), ONEM (0,5% employeur), INPP (3% pour 1–50 employés)
- `src/data/rdc-payroll-accounts.json` – mapping codes -> numéros OHADA exacts (banques 521xxx, caisse 57xxxx via Treasury)

## 16. Edge Cases
- Employé sans allocation => défaut 100% centre principal.
- Salaire base zéro (stagiaire) mais primes => assiette contributions ajustée.
- Plafond cotisation inférieur à base => montant tronqué.
- Changement de taux en milieu de mois => prorata temporis (déféré v2).
- Net négatif => marquer payslip en anomalie (statut FLAGGED, hors v1?).

## 17. Qualité & Validation
- Après migration: `verify-prisma.js`.
- Calcul -> `test-payroll-calculation.js` (PASS attendu).
- Journal -> `test-payroll-journal-integrity.js` (équilibre PASS).
- Audits -> `audit-payroll-balances.js` (écart tolérance zéro).

## 18. Récapitulatif Implementation Contracts
Entrées moteur: { baseSalary, primes[], contributionSchemes[], taxRule, adjustments[], costAllocations[] }
Sorties moteur: { lines[], grossAmount, netAmount, employerChargesTotal, allocations[] }
Erreurs: taux incohérent (>1), total allocations != 1, bracket non trié, rounding overflow.

## 19. Prochaines Étapes
1. Valider structure modèles & comptes avec vos taux + barèmes.
2. Fournir JSON barème & contributions.
3. Lancer migration Phase 1.
4. Implémenter moteur (Phase 2) + tests unitaires.
5. Vous livrer endpoints de génération & recalcul pour revue.

---
Commentaires / Ajustements bienvenus avant démarrage Phase 1.

## 20. Paramètres de Calcul – RDC (synthèse opérationnelle)

Cette section rassemble les règles de calcul à implémenter pour la RDC:

- Base imposable IPR (mensuelle):
  RI = BRUT – Cotisations sociales salariales (CNSS sal.) – Frais pro forfaitaires (ex. 25% de BRUT après CNSS; paramétrable).
  Calcul en CDF: convertir RI EUR→CDF au taux de fin de mois, appliquer barème progressif, plafonner l’impôt à 30% du RI, appliquer le minimum légal, reconvertir CDF→EUR.
- Barème IPR (exemple indicatif): [0;1 944 000] 3% ; (1 944 001;21 600 000] 15% ; (21 600 001;43 200 000] 30% ; au‑delà 40%.
- CNSS: assiette plafonnée (paramètre), salarié 5%, employeur 5% + risque pro 0–4%.
- ONEM: 0,5% employeur sur rémunération mensuelle totale.
- INPP: 3% (1–50 employés), 2% (51–300), 1% (>300) – employeur uniquement.
- AEN: valeur intégrée au BRUT; contrepartie 421; transfert 6617/78 si la charge a été comptabilisée ailleurs.

Implémentation:
- Représenter CNSS/ONEM/INPP comme `ContributionScheme` distincts (employeeRate/employerRate/ceiling/baseKind, flags employeeOnly/employerOnly si besoin).
- Représenter IPR comme `TaxRule` à tranches (brackets triées), avec métadonnées: `{ minMonthly, maxRatioOfTaxable }`.
- Ajouter une table `FxRate` (ou réutiliser un mécanisme existant) si on souhaite tracer la conversion utilisée par période.
