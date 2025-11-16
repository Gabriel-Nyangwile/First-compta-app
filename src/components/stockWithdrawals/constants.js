export const TYPE_OPTIONS = [
  { value: "PRODUCTION", label: "Production" },
  { value: "SALE", label: "Vente" },
  { value: "SAMPLE", label: "Échantillon" },
  { value: "OTHER", label: "Autre" },
];

export const TYPE_LABELS = TYPE_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

export const STATUS_LABELS = {
  DRAFT: "Brouillon",
  CONFIRMED: "Confirmée",
  POSTED: "Enregistrée",
  CANCELLED: "Annulée",
};
