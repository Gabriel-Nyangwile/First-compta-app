// scripts/import-accounts.js

import fs from "fs";
import csvParser from "csv-parser";
import prisma from "../src/lib/prisma.js";

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

  try {
    await prisma.$transaction(
      records.map((record) =>
        prisma.account.create({
          data: {
            number: record.numero,
            label: record.libelle,
          },
        })
      )
    );
    console.log("Importation des comptes terminée avec succès.");
  } catch (error) {
    console.error("Erreur lors de l'importation des comptes:", error);
  } finally {
    await prisma.$disconnect();
  }
}

importAccounts();
