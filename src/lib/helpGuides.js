import fs from "node:fs/promises";
import path from "node:path";

export const HELP_GUIDES = [
  { slug: "achats", title: "Achats", file: "purchase-user-guide.md" },
  { slug: "ventes", title: "Ventes", file: "sales-user-guide.md" },
  { slug: "immobilisations", title: "Immobilisations", file: "assets-user-guide.md" },
  { slug: "production", title: "Production", file: "production-user-guide.md" },
  { slug: "tresorerie", title: "Trésorerie", file: "treasury-user-guide.md" },
  { slug: "exercice", title: "Ouverture et clôture", file: "fiscal-year-user-guide.md" },
  { slug: "lettrage", title: "Lettrage", file: "lettering-user-guide.md" },
  { slug: "paie-personnel", title: "Personnel et paie", file: "personnel-payroll-user-guide.md" },
  { slug: "capital", title: "Capital", file: "capital-operations-user-guide.md" },
];

export function getHelpGuide(slug) {
  return HELP_GUIDES.find((guide) => guide.slug === slug) || null;
}

export async function readHelpGuide(slug) {
  const guide = getHelpGuide(slug);
  if (!guide) return null;
  const fullPath = path.join(process.cwd(), "docs", guide.file);
  const raw = await fs.readFile(fullPath, "utf8");
  const userOnly = raw.split(/^##\s+\d*\.?\s*Références techniques\b/im)[0].trim();
  return { ...guide, content: userOnly };
}
