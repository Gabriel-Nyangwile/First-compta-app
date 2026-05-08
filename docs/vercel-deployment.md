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

Un script de garde est disponible:

```bash
npm run vercel:predeploy
```

Ce script execute `prisma migrate status && prisma migrate deploy` uniquement si `VERCEL_ENV=production`, afin de bloquer un deploiement prod si les migrations ne sont pas pretes.

## Resolution pas a pas d'une erreur 500 en production

1. **Confirmer l'erreur**
   - Ouvrir `Vercel > Project > Functions > Logs`.
   - Rejouer l'endpoint en erreur (ex: `/api/auth`) et noter le message exact.

2. **Vérifier les variables d'environnement prod**
   - Ouvrir `Vercel > Project Settings > Environment Variables`.
   - Vérifier en priorité `DATABASE_URL`, `ADMIN_TOKEN`, `NEXT_PUBLIC_APP_URL`.
   - Confirmer que `DATABASE_URL` pointe bien vers la base de production.

3. **Vérifier et appliquer les migrations Prisma**
   - Depuis un terminal securise avec la `DATABASE_URL` de prod:
   ```bash
   npm run migrate:status
   npm run migrate:deploy
   ```

4. **Controler les objets critiques auth en base**
   - Vérifier la table `CompanyMembership`.
   - Vérifier les colonnes `User.companyId`, `User.isActive`, `User.canCreateCompany`.
   - Vérifier la valeur `PLATFORM_ADMIN` dans l'enum `UserRole`.
   - Si un objet manque: migration non appliquee ou partiellement appliquee.

5. **Redeployer apres migration**
   - Relancer un redeploiement Vercel (idealement sans cache).
   - Retester immediatement l'endpoint en erreur.

6. **Smoke tests post-deploiement**
   - Tester connexion utilisateur avec mot de passe.
   - Tester utilisateur legacy/OAuth sans mot de passe.
   - Le code auth retourne maintenant `401` (et non `500`) quand `password` est null.

7. **Durcir les futurs deploiements**
   - Ajouter en Production Build Command:
   ```bash
   npm run vercel:predeploy && npm run build
   ```
   - Ce garde-fou empeche un deploy prod avec migrations manquantes.

8. **Rollback en cas d'incident**
   - Restaurer le dernier deploiement stable.
   - Corriger les migrations sur la base prod.
   - Re-deployer ensuite avec `npm run vercel:predeploy`.

## Lire les logs

Un log Vercel termine par:

```text
Build Completed in /vercel/output
```

signifie que la compilation a reussi. Si le deploiement reste marque en erreur, chercher l'erreur apres cette ligne, dans l'etape de deploiement/runtime, ou dans les logs de la fonction appelee.
