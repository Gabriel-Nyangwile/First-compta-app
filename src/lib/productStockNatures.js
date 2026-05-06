export const STOCK_NATURE_OPTIONS = [
  {
    value: "PURCHASED",
    label: "Marchandises",
    description: "Biens achetés destinés à être revendus",
    inventoryPrefixes: ["31"],
    variationPrefixes: ["6031", "6030", "603"],
  },
  {
    value: "RAW_MATERIALS",
    label: "Matières premières et fournitures liées",
    description: "Matières et fournitures entrant dans la fabrication",
    inventoryPrefixes: ["32"],
    variationPrefixes: ["6032"],
  },
  {
    value: "CONSUMABLE_SUPPLIES",
    label: "Matières consommables et autres approvisionnements",
    description: "Matières consommables, fournitures, emballages",
    inventoryPrefixes: ["33"],
    variationPrefixes: ["6033"],
  },
  {
    value: "WORK_IN_PROGRESS",
    label: "Produits et travaux en cours",
    description: "Production non terminée",
    inventoryPrefixes: ["34"],
    variationPrefixes: ["734"],
  },
  {
    value: "SERVICE_IN_PROGRESS",
    label: "Services en cours",
    description: "Études et prestations de services en cours",
    inventoryPrefixes: ["35"],
    variationPrefixes: ["735"],
  },
  {
    value: "FINISHED_GOODS",
    label: "Produits finis",
    description: "Produits fabriqués terminés",
    inventoryPrefixes: ["36"],
    variationPrefixes: ["736"],
  },
  {
    value: "INTERMEDIATE_RESIDUAL_PRODUCTS",
    label: "Produits intermédiaires et résiduels",
    description: "Produits intermédiaires, déchets, rebuts et récupération",
    inventoryPrefixes: ["37"],
    variationPrefixes: ["737"],
  },
  {
    value: "PRODUCED",
    label: "Production vendue (legacy)",
    description: "Ancienne configuration conservée pour compatibilité",
    inventoryPrefixes: ["31", "32", "33", "34", "35", "36", "37"],
    variationPrefixes: ["701"],
    legacy: true,
  },
];

export const STOCK_NATURE_LABELS = Object.fromEntries(
  STOCK_NATURE_OPTIONS.map((option) => [option.value, option.label])
);

export const STOCK_NATURES = new Set(STOCK_NATURE_OPTIONS.map((option) => option.value));

export function getStockNatureConfig(value) {
  return (
    STOCK_NATURE_OPTIONS.find((option) => option.value === value) ||
    STOCK_NATURE_OPTIONS[0]
  );
}

export function formatPrefixes(prefixes = []) {
  return prefixes.join(" / ");
}

export function accountMatchesPrefixes(account, prefixes = []) {
  return prefixes.some((prefix) => account?.number?.startsWith(prefix));
}
