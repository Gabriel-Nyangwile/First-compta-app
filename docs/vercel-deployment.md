# Deploiement Vercel

Ce projet est une application Next.js avec Prisma/PostgreSQL. Le build Vercel doit generer le client Prisma avant `next build`.

## Build

Le script `postinstall` execute:

```bash
prisma generate
```

Cela evite un client Prisma obsolete lorsque Vercel reutilise son cache de dependances.

Le script `build` reste:

```bash
next build
```

Dans Vercel, garder le preset `Next.js` et laisser le Build Command par defaut, ou le definir explicitement a:

```bash
npm run build
```

## Variables Vercel minimales

A creer dans `Project Settings > Environment Variables`:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
ADMIN_TOKEN="..."
NEXT_PUBLIC_APP_URL="https://your-project.vercel.app"
DEFAULT_COMPANY_ID="..."
DEFAULT_COMPANY_CURRENCY="CDF"
PLATFORM_ADMIN_EMAIL="admin@example.com"
PLATFORM_ADMIN_PASSWORD="..."
PLATFORM_ADMIN_USERNAME="platform-admin"
```

Variables optionnelles selon les modules utilises:

```bash
NEXT_PUBLIC_ADMIN_TOKEN="..."
COMPANY_NAME="..."
COMPANY_ADDRESS="..."
COMPANY_SIRET="..."
COMPANY_VAT="..."
ANTHROPIC_API_KEY="..."
SLACK_WEBHOOK_URL="..."
```

## Migrations Prisma

Vercel ne lance pas automatiquement les migrations de base de donnees. Appliquer les migrations sur la base cible avant ou pendant la livraison:

```bash
npm run migrate:deploy
```

Eviter de lancer `prisma migrate deploy` automatiquement sur les previews si elles pointent vers la base de production. Utiliser une base separee pour les environnements Preview quand des migrations sont testees.

## Premier administrateur plateforme

Sur une base vide, la creation de societe exige un `PLATFORM_ADMIN`. Apres les migrations, creer ou promouvoir le premier administrateur avec:

```bash
npm run bootstrap:platform-admin
```

La commande lit:

```bash
PLATFORM_ADMIN_EMAIL
PLATFORM_ADMIN_PASSWORD
PLATFORM_ADMIN_USERNAME
```

En production, executer cette commande depuis un environnement qui pointe vers la base Vercel/Neon avec `DATABASE_URL`.

## Lire les logs

Un log Vercel termine par:

```text
Build Completed in /vercel/output
```

signifie que la compilation a reussi. Si le deploiement reste marque en erreur, chercher l'erreur apres cette ligne, dans l'etape de deploiement/runtime, ou dans les logs de la fonction appelee.
