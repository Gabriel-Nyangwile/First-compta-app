import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
    // Règles globales minimales ici; règles spécifiques via overrides plus bas
    rules: {}
  },
  // UI: Interdiction stricte toFixed(2)
  {
    files: ["src/app/**","src/components/**"],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='toFixed'] Literal[value=2]",
          message: "Éviter toFixed(2) direct en UI. Utiliser <Amount /> ou formatAmount/formatAmountPlain."
        }
      ]
    }
  },
  // Backend / scripts: autoriser (calculs internes, arrondis contrôlés)
  {
    files: ["scripts/**","src/lib/**","src/app/api/**"],
    rules: { 'no-restricted-syntax': 'off' }
  }
];

export default eslintConfig;
