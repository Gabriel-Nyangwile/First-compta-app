import ExcelJS from "exceljs";

const templateDefinitions = {
  balance: {
    sheet: "Balance",
    fileName: "opening-balance-template.xlsx",
    headers: ["accountNumber", "label", "debit", "credit"],
    rows: [
      ["101100", "Capital social", 0, 50000],
      ["106100", "Reserve legale", 0, 5000],
      ["512000", "Banque - compte courant", 25000, 0],
      ["411000", "Clients", 20000, 0],
      ["401000", "Fournisseurs", 0, 15000],
      ["310000", "Stocks", 8000, 0],
      ["213000", "Creances diverses", 17000, 0],
    ],
  },
  stock: {
    sheet: "Stock",
    fileName: "opening-stock-template.xlsx",
    headers: [
      "sku",
      "name",
      "qty",
      "unitCost",
      "inventoryAccountNumber",
      "stockVariationAccountNumber",
    ],
    rows: [
      ["STK-001", "Article inventaire", 10, 25, "310000", "603000"],
      ["STK-002", "Produit fini", 5, 120, "310000", "603000"],
    ],
  },
  ar: {
    sheet: "Clients",
    fileName: "opening-ar-template.xlsx",
    headers: [
      "clientCode",
      "name",
      "email",
      "phone",
      "address",
      "accountNumber",
      "openingBalance",
    ],
    rows: [
      ["CLI-001", "Client exemple", "client@example.test", "", "", "411000", 15000],
    ],
  },
  ap: {
    sheet: "Fournisseurs",
    fileName: "opening-ap-template.xlsx",
    headers: [
      "supplierCode",
      "name",
      "email",
      "phone",
      "address",
      "accountNumber",
      "openingBalance",
    ],
    rows: [
      ["FOU-001", "Fournisseur exemple", "supplier@example.test", "", "", "401000", 12000],
    ],
  },
  assets: {
    sheet: "Immobilisations",
    fileName: "opening-assets-template.xlsx",
    headers: [
      "assetCode",
      "name",
      "categoryCode",
      "acquisitionDate",
      "acquisitionCost",
      "accumulatedDepreciation",
      "netBookValue",
      "remainingLifeMonths",
      "salvage",
    ],
    rows: [
      ["IMMO-001", "Immobilisation exemple", "MMAMIN4200", "2024-01-01", 1200, 240, 960, 36, 0],
    ],
  },
};

export function getOpeningTemplateDefinition(kind) {
  return templateDefinitions[kind] || null;
}

export function listOpeningTemplates() {
  return Object.entries(templateDefinitions).map(([kind, definition]) => ({
    kind,
    fileName: definition.fileName,
    sheet: definition.sheet,
    headers: definition.headers,
  }));
}

export async function buildOpeningTemplateBuffer(kind) {
  const definition = getOpeningTemplateDefinition(kind);
  if (!definition) throw new Error(`Template inconnu: ${kind}`);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(definition.sheet);
  worksheet.addRow(definition.headers);
  for (const row of definition.rows) worksheet.addRow(row);
  worksheet.columns.forEach((column) => {
    column.width = Math.max(
      14,
      ...column.values.map((value) => String(value || "").length + 2)
    );
  });
  return workbook.xlsx.writeBuffer();
}
