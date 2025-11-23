# AGENTS.md

## 🧭 Référence principale : `.github/copilot-instructions.md`

Toutes les directives détaillées de ce projet (conventions, commandes, structure, bonnes pratiques, patterns UI, etc.) se trouvent dans :

**📄 `.github/copilot-instructions.md`**

Ce fichier contient :
- Les conventions de code (Next.js 15.5, Prisma, TailwindCSS)
- Les scripts de build et de développement
- Les règles de structure du projet et de nommage
- Les modèles de tests, commits et revues de code
- Les consignes d’intégration continue (CI/CD, si présentes)

L’assistant Codex ou Copilot doit **lire ce fichier comme source prioritaire de directives**.

En cas de divergence entre `AGENTS.md` et `.github/copilot-instructions.md`,  
👉 **le fichier `.github/copilot-instructions.md` prévaut.**

---

## ⚙️ Contexte du projet

- **Framework** : Next.js **15.5.x** (App Router, JavaScript pur)
- **CSS Framework** : TailwindCSS **v4**
- **ORM** : Prisma avec **PostgreSQL**
- **Exécution** : environnement **local**
- **Gestionnaire de paquets** : npm
- **Emplacement** : projet racine (pas encore publié sur GitHub)
- **Exports Personnel Sécurisés** : Les endpoints d'export (CSV/PDF/XLSX) pour `personnel/summary` et `personnel/trend` appliquent un contrôle de jeton en production (header `x-admin-token` correspondant à `ADMIN_TOKEN` ou `NEXT_PUBLIC_ADMIN_TOKEN`). En environnement non‑production, le contrôle est suspendu pour faciliter les tests.
- **Paramètres Query RH** :
  - `GET /api/personnel/summary?year=YYYY&month=MM` génère la synthèse sur la fin du mois spécifié.
  - `GET /api/personnel/trend?months=N` (1–24) retourne la fenêtre glissante N mois avec `activeStart`, `activeEnd`, `avgHeadcount`, `hiresRatePct`, `exitTurnoverPct`.

---

## 🗄️ Base de données Prisma

### 📦 Configuration
- Type : **PostgreSQL**
- Fichier de configuration : `.env`
- Variable attendue :
    DATABASE_URL="postgresql://postgres:Jesus@localhost:5432/first-compta"

- Les commandes suivantes doivent être utilisées après chaque modification du schéma :
```bash
npx prisma generate
npx prisma migrate dev -n "<message>"

# Lancer le serveur de dev
npm run dev

# Prisma ORM
npx prisma generate
npx prisma migrate dev -n "<message>"
npx prisma studio

# Lint / formatage (si configurés)
npm run lint
npm run format

# Tests
npm test


---

### 💡 Ce que ce fichier fait

- Il sert de **guide de contexte et d’index** pour Codex.  
- Il permet à **Copilot** et **Codex** de trouver automatiquement tes consignes techniques.  
- Il indique clairement :
  - que **PostgreSQL** est utilisé via Prisma,
  - que l’exécution est **locale**,
  - que le fichier de directives se trouve dans `.github/`.

---

