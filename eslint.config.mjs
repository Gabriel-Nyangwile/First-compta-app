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
  // UI: Interdiction d'importer l'ancien chemin legacy NavbarDropdown (fichier supprimé)
  {
    files: ["src/app/**","src/components/**"],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/components/NavbarDropdown',
              message: 'Chemin legacy supprimé. Importer depuis "@/components/navbar/NavbarDropdown" ou le barrel "@/components/navbar".'
            },
            {
              name: '@/components/NavbarDropdown.jsx',
              message: 'Chemin legacy supprimé. Importer depuis "@/components/navbar/NavbarDropdown" ou le barrel "@/components/navbar".'
            },
            {
              name: '@/components/NavbarDropdown.js',
              message: 'Chemin legacy supprimé. Importer depuis "@/components/navbar/NavbarDropdown" ou le barrel "@/components/navbar".'
            },
            {
              name: '@/component/navbar/NavbarDropdown',
              message: 'Alias incorrect ("component" singulier). Utiliser "@/components/navbar/NavbarDropdown".'
            },
            {
              name: '@/component/navbar/Navbar',
              message: 'Alias incorrect ("component" singulier). Utiliser "@/components/navbar".'
            }
          ],
          patterns: [
            {
              group: ['**/components/NavbarDropdown','**/components/NavbarDropdown.*'],
              message: 'Chemin legacy NavbarDropdown interdit. Utiliser components/navbar/NavbarDropdown.'
            }
          ]
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

// Garde-fou : si quelqu'un recrée le fichier legacy exact, il sera immédiatement en erreur.
eslintConfig.push({
  files: ["src/components/NavbarDropdown.jsx"],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Program',
        message: 'Fichier legacy obsolète. Ne pas recréer \"src/components/NavbarDropdown.jsx\". Utiliser src/components/navbar/NavbarDropdown.jsx.'
      }
    ]
  }
});

export default eslintConfig;
