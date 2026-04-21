// scripts/import-accounts.js

import fs from "fs";
import csvParser from "csv-parser";
import prisma from "../src/lib/prisma.js";

const COMPANY_NAME = process.env.COMPANY_NAME || 'Entreprise Demo';

async function getOrCreateCompany() {
  let company = await prisma.company.findFirst({ where: { name: COMPANY_NAME } });
  if (!company) {
    company = await prisma.company.create({ data: { name: COMPANY_NAME } });
    console.log(`Created company "${COMPANY_NAME}"`);
  }
  return company;
}

async function importAccounts() {
  const csvFilePath = "./src/data/plan-comptable.csv"; // Remplace par le chemin de ton fichier
  const parser = fs
    .createReadStream(csvFilePath)
    .pipe(csvParser({ separator: ";", skipEmptyLines: true }));

  const records = [];

  for await (const record of parser) {
    records.push(record);
  }

  if (records.length > 0) {
    console.log('First record:', records[0]);
    console.log('Keys:', Object.keys(records[0]));
  }

  console.log(`Lecture de ${records.length} lignes depuis le fichier CSV.`);

  const company = await getOrCreateCompany();

  try {
    let created = 0;
    let skipped = 0;
    for (const record of records) {
      const existing = await prisma.account.findUnique({
        where: { companyId_number: { companyId: company.id, number: record.numero } },
      });
      if (!existing) {
        await prisma.account.create({
          data: {
            number: record.numero,
            label: record.libelle,
            companyId: company.id,
          },
        });
        created++;
      } else {
        skipped++;
      }
    }
    console.log(`Importation terminée : ${created} créés, ${skipped} déjà existants.`);
  } catch (error) {
    console.error("Erreur lors de l'importation des comptes:", error);
  } finally {
    await prisma.$disconnect();
  }
}

importAccounts();
