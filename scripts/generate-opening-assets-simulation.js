#!/usr/bin/env node
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import prisma from "../src/lib/prisma.js";

const outDir = path.resolve("scripts", "templates");

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function findPreferredCategory(categories, preferredCodes) {
  for (const code of preferredCodes) {
    const match = categories.find((category) => category.code === code);
    if (match) return match;
  }
  return null;
}

function buildScenario(categories) {
  const chosen = [];
  const candidates = [
    ["CONBCI1300", "CONBHA1400", "CONBLA1500"],
    ["IMILOG3000", "IMIBRE2000", "IMIMAR4000"],
    ["MMAMIN4200", "MMAMAB4100", "MMAMAR4420"],
    ["MMAMOB4400", "MMEMAT1100", "MMEOIN1200"],
    ["MMTMTV5150", "MMTMTL5100", "MTPPENS5120"],
    ["MTPGENS5110", "MTPETR5130", "MTPPSM1230"],
  ];

  for (const preferredCodes of candidates) {
    const match = findPreferredCategory(categories, preferredCodes);
    if (match && !chosen.some((item) => item.code === match.code)) chosen.push(match);
  }

  for (const category of categories) {
    if (chosen.length >= 6) break;
    if (!chosen.some((item) => item.code === category.code)) chosen.push(category);
  }

  const definitions = [
    {
      suffix: "BAT-001",
      name: "Bureau administratif siège",
      acquisitionDate: "2020-03-15",
      baseCost: 180000,
      remainingRatio: 0.78,
      salvageRatio: 0,
    },
    {
      suffix: "LOG-002",
      name: "ERP comptable et licences", 
      acquisitionDate: "2024-01-10",
      baseCost: 18500,
      remainingRatio: 0.62,
      salvageRatio: 0,
    },
    {
      suffix: "INF-003",
      name: "Serveurs et postes de travail",
      acquisitionDate: "2023-07-01",
      baseCost: 24000,
      remainingRatio: 0.55,
      salvageRatio: 0.04,
    },
    {
      suffix: "MOB-004",
      name: "Mobilier open space et salle réunion",
      acquisitionDate: "2022-09-05",
      baseCost: 12000,
      remainingRatio: 0.65,
      salvageRatio: 0.02,
    },
    {
      suffix: "VEH-005",
      name: "Véhicule utilitaire logistique",
      acquisitionDate: "2024-06-20",
      baseCost: 32000,
      remainingRatio: 0.42,
      salvageRatio: 0.08,
    },
    {
      suffix: "ENG-006",
      name: "Groupe électrogène chantier",
      acquisitionDate: "2021-11-12",
      baseCost: 56000,
      remainingRatio: 0.48,
      salvageRatio: 0.05,
    },
  ];

  return chosen.slice(0, definitions.length).map((category, index) => {
    const definition = definitions[index];
    const cost = round2(definition.baseCost);
    const salvage = round2(cost * definition.salvageRatio);
    const depreciableBase = round2(cost - salvage);
    const netBookValue = round2(Math.max(salvage, depreciableBase * definition.remainingRatio + salvage));
    const accumulatedDepreciation = round2(cost - netBookValue);
    const remainingLifeMonths = Math.max(1, Math.min(category.durationMonths, Math.round(category.durationMonths * definition.remainingRatio)));

    return {
      assetCode: `${category.code}-${definition.suffix}`,
      name: definition.name,
      categoryCode: category.code,
      acquisitionDate: definition.acquisitionDate,
      acquisitionCost: cost,
      accumulatedDepreciation,
      netBookValue,
      remainingLifeMonths,
      salvage,
    };
  });
}

function buildEdgeCases(categories) {
  const edgeCases = [];
  const categoryMap = {};
  
  // Groupe les catégories par code pour sélection rapide
  for (const cat of categories) {
    if (!categoryMap[cat.code]) categoryMap[cat.code] = cat;
  }

  // 1. Actif sans dépréciation (100% VNC)
  const cat1 = categoryMap["CONBCI1300"] || categories[0];
  if (cat1) {
    const cost = 8500;
    edgeCases.push({
      assetCode: `${cat1.code}-EGE-001-NODEP`,
      name: "Construction neuve sans dépréciation",
      categoryCode: cat1.code,
      acquisitionDate: "2025-12-15",
      acquisitionCost: cost,
      accumulatedDepreciation: 0,
      netBookValue: cost,
      remainingLifeMonths: cat1.durationMonths,
      salvage: 0,
    });
  }

  // 2. Actif très déprécié (92%)
  const cat2 = categoryMap["IMILOG3000"] || categories[1];
  if (cat2) {
    const cost = 5000;
    const accumulated = round2(cost * 0.92); // 4600
    const nbv = round2(cost - accumulated); // 400
    edgeCases.push({
      assetCode: `${cat2.code}-EGE-002-OWNDEP`,
      name: "Logiciel hérité très amorti",
      categoryCode: cat2.code,
      acquisitionDate: "2014-06-20",
      acquisitionCost: cost,
      accumulatedDepreciation: accumulated,
      netBookValue: nbv,
      remainingLifeMonths: 4,
      salvage: 0,
    });
  }

  // 3. Actif très neuf (3% dépréciation)
  const cat3 = categoryMap["MMAMIN4200"] || categories[2];
  if (cat3) {
    const cost = 7200;
    const accumulated = round2(cost * 0.03); // 216
    const nbv = round2(cost - accumulated); // 6984
    edgeCases.push({
      assetCode: `${cat3.code}-EGE-003-NEWBUY`,
      name: "Équipement informatique neuf (3 mois)",
      categoryCode: cat3.code,
      acquisitionDate: "2026-01-05",
      acquisitionCost: cost,
      accumulatedDepreciation: accumulated,
      netBookValue: nbv,
      remainingLifeMonths: round2(cat3.durationMonths * 0.97), // 97% vie restante
      salvage: 0,
    });
  }

  // 4. Valeur résiduelle élevée (40% du coût)
  const cat4 = categoryMap["MMTMTV5150"] || categories[3];
  if (cat4) {
    const cost = 45000;
    const salvage = 18000; // 40%
    const depreciableBase = cost - salvage; // 27000
    const remainingRatio = 0.35;
    const nbv = round2(Math.max(salvage, depreciableBase * remainingRatio + salvage)); // max(18000, 9450+18000) = 27450
    const accumulated = round2(cost - nbv); // 17550
    edgeCases.push({
      assetCode: `${cat4.code}-EGE-004-HIGHSAL`,
      name: "Véhicule commercial valeur résiduelle élevée",
      categoryCode: cat4.code,
      acquisitionDate: "2022-04-10",
      acquisitionCost: cost,
      accumulatedDepreciation: accumulated,
      netBookValue: nbv,
      remainingLifeMonths: Math.max(1, Math.round(cat4.durationMonths * remainingRatio)),
      salvage,
    });
  }

  // 5. Durée de vie très courte (2 mois restants)
  const cat5 = categoryMap["MTPGENS5110"] || categories[4];
  if (cat5) {
    const cost = 3200;
    const salvage = 200; // 6.25%
    const depreciableBase = cost - salvage; // 3000
    const remainingRatio = 0.02; // 2 mois / 120 mois = 1.67%
    const nbv = round2(Math.max(salvage, depreciableBase * remainingRatio + salvage)); // max(200, 60+200) = 260
    const accumulated = round2(cost - nbv); // 2940
    edgeCases.push({
      assetCode: `${cat5.code}-EGE-005-EXPIR`,
      name: "Équipement en fin de vie (2 mois restants)",
      categoryCode: cat5.code,
      acquisitionDate: "2023-12-01",
      acquisitionCost: cost,
      accumulatedDepreciation: accumulated,
      netBookValue: nbv,
      remainingLifeMonths: 2,
      salvage,
    });
  }

  // 6. Montants décimaux complexes (arrondis, centimes)
  const cat6 = categoryMap["MMEMAT1100"] || categories[5] || categories[0];
  if (cat6) {
    const cost = 15234.57;
    const accumulated = 4567.89;
    const nbv = round2(cost - accumulated); // 10666.68
    edgeCases.push({
      assetCode: `${cat6.code}-EGE-006-DECIM`,
      name: "Matériel avec montants décimaux complexes",
      categoryCode: cat6.code,
      acquisitionDate: "2023-05-17",
      acquisitionCost: cost,
      accumulatedDepreciation: accumulated,
      netBookValue: nbv,
      remainingLifeMonths: Math.round(cat6.durationMonths * 0.70),
      salvage: 500,
    });
  }

  return edgeCases;
}

async function main() {
  const companyId = process.env.DEFAULT_COMPANY_ID || process.env.COMPANY_ID || null;
  if (!companyId) throw new Error("DEFAULT_COMPANY_ID requis");

  const categories = await prisma.assetCategory.findMany({
    where: { companyId, active: true },
    select: { code: true, label: true, durationMonths: true },
    orderBy: { code: "asc" },
  });
  if (!categories.length) throw new Error("Aucune catégorie d'immobilisation active trouvée");

  const scenario = buildScenario(categories);
  const edgeCases = buildEdgeCases(categories);
  const allAssets = [...scenario, ...edgeCases];
  
  if (!allAssets.length) throw new Error("Impossible de construire le scénario de simulation");

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, "opening-assets-simulation.xlsx");

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Immobilisations");
  worksheet.addRow([
    "assetCode",
    "name",
    "categoryCode",
    "acquisitionDate",
    "acquisitionCost",
    "accumulatedDepreciation",
    "netBookValue",
    "remainingLifeMonths",
    "salvage",
  ]);

  for (const row of allAssets) {
    worksheet.addRow([
      row.assetCode,
      row.name,
      row.categoryCode,
      row.acquisitionDate,
      row.acquisitionCost,
      row.accumulatedDepreciation,
      row.netBookValue,
      row.remainingLifeMonths,
      row.salvage,
    ]);
  }

  await workbook.xlsx.writeFile(filePath);

  console.log(
    JSON.stringify(
      {
        filePath,
        companyId,
        assets: allAssets.length,
        nominal: scenario.length,
        edgeCases: edgeCases.length,
        categories: allAssets.map((row) => row.categoryCode),
        totals: {
          acquisitionCost: round2(allAssets.reduce((sum, row) => sum + row.acquisitionCost, 0)),
          accumulatedDepreciation: round2(allAssets.reduce((sum, row) => sum + row.accumulatedDepreciation, 0)),
          netBookValue: round2(allAssets.reduce((sum, row) => sum + row.netBookValue, 0)),
        },
      },
      null,
      2
    )
  );
}


main()
  .catch((error) => {
    console.error("Opening assets simulation generation error:", error.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });