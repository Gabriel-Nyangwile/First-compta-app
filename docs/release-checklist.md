# Checklist release go/no-go

## Objectif

Cette checklist sert de gate finale avant un deploiement important ou une release taguee. Elle complete les checklists specialisees, notamment la checklist multi-societe, et force une decision claire: GO, GO sous reserve documentee, ou NO-GO.

## 1. Pre-requis

- La branche contient seulement les changements prevus pour la release.
- Les migrations Prisma sont presentes, relues et coherentes avec `prisma/schema.prisma`.
- `.env.local` pointe vers l'environnement local ou de recette attendu, pas par erreur vers Neon production.
- Une sauvegarde recente existe avant toute correction de donnees:

```bash
npm run backup:data
```

- Les variables critiques sont connues et documentees: `DATABASE_URL`, `DEFAULT_COMPANY_ID`, `ADMIN_TOKEN` si les exports proteges sont testes.
- Les scripts correctifs ou destructifs ne sont pas lances contre Neon sans dry-run, sauvegarde et validation explicite.

## 2. Gate technique courte

Cette gate doit passer avant commit ou avant push:

```bash
npm run ci:quick
```

Elle couvre lint, validation Prisma, pack rapide et build Next.js. En cas d'echec, la release est NO-GO tant que la cause n'est pas corrigee.

## 3. Gate release complete

Avant une livraison importante, lancer:

```bash
npm run ci:full
```

Si la suite complete est trop longue, lancer explicitement chaque domaine concerne:

```bash
npm run audit:pack:accounting
npm run audit:pack:payroll
npm run audit:pack:treasury
npm run audit:pack:stock
npm run audit:pack:production
npm run audit:pack:multi-company
npm run audit:pack:opening
```

Critere de sortie: aucun pack en echec. Un avertissement peut etre accepte seulement s'il est compris, documente et sans impact data.

## 4. Controles data sensibles

Ces controles sont obligatoires apres migration, import, restauration ou correction de donnees:

```bash
npm run audit:pack:multi-company
npm run audit:pack:stock
npm run audit:pack:accounting
```

Controles cibles utiles:

```bash
npm run stock:reconcile
npm run repair:cross-company-transaction-accounts
```

Ces scripts doivent annoncer zero correction attendue avant de passer en GO. S'ils proposent des modifications, sauvegarder, comprendre le rapport et appliquer uniquement avec l'option documentee du script.

## 5. Gate base de donnees

Local ou recette:

```bash
npx prisma validate
npx prisma migrate status
```

Production Neon/Vercel:

```bash
npm run migrate:deploy
```

La release est NO-GO si la base cible n'est pas certaine, si `DATABASE_URL` pointe vers un environnement inattendu, ou si une migration reste ambigue.

## 6. Verification Vercel apres deploiement

Apres push et redeploiement:

- Le deployment Vercel est `Ready`.
- `/api/health` retourne `ok: true` et `db.ok: true`.
- `/api/companies/public` retourne une reponse valide.
- Connexion `PLATFORM_ADMIN` reussie.
- La liste des societes affiche les societes attendues.
- Connexion utilisateur standard reussie sur sa societe autorisee.
- Navigation rapide: tableau de bord, journal, achats, tresorerie, stock, aide.

Un 500 sur `/api/companies/public`, `/api/auth/signin` ou `/api/health` bloque la release tant que les logs Vercel ne sont pas expliques.

## 7. Decision

| Decision | Conditions |
| --- | --- |
| GO | `ci:quick` OK, gate domaine OK, migrations OK, Vercel sain, aucune fuite multi-societe |
| GO sous reserve | Anomalie mineure documentee, sans impact financier, data ou securite, avec contournement clair |
| NO-GO | Echec build, migration incertaine, pack critique rouge, 500 Vercel, auth instable, fuite cross-company |

## 8. Rollback

Avant de livrer, identifier:

- le dernier deployment Vercel stable;
- la sauvegarde ou snapshot Neon utilisable;
- les scripts correctifs lances pendant la release;
- la personne qui valide la reprise.

Rollback minimal:

1. geler les operations utilisateur si l'incident touche la data;
2. revenir au dernier deployment Vercel stable;
3. restaurer la sauvegarde si l'incident est structurel;
4. relancer `npm run ci:quick` puis les packs du domaine touche.

## 9. Notes de release

Avant tag ou livraison formelle:

- mettre a jour `CHANGELOG.md`;
- renseigner [release-validation-log.md](./release-validation-log.md);
- verifier `README.md` et `README.fr.md`;
- verifier les guides visibles dans le menu Aide;
- noter les commandes d'audit executees et leur resultat.
