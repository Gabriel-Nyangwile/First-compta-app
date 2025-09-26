# Copilot Instructions for AI Coding Agents

## Project Overview
- This is a Next.js app using the app directory structure, bootstrapped with `create-next-app`.
- Data layer uses Prisma ORM, with schema and migrations in `prisma/`.
- Main business logic and UI are in `src/app/` and `src/components/`.
- CSV data is stored in `src/data/`.

## Key Architectural Patterns
- **API routes**: Located in `src/app/api/`, organized by resource (e.g., `account`, `clients`, `invoice`). Each resource may have subroutes for actions (e.g., `create`, `search`).
- **Pages and Components**: UI pages are in `src/app/`, with reusable components in `src/components/`. Pages often use server actions from `src/lib/serverActions/`.
- **Prisma Integration**: Database schema in `prisma/schema.prisma`. Use `prisma migrate` for DB changes. Access Prisma client via `src/lib/prisma.js`.
- **Client/Invoice Logic**: Shared logic for clients and invoices is in `src/lib/serverActions/clientAndInvoice.js`.

## Developer Workflows
- **Start dev server**: `npm run dev` (or `yarn dev`, `pnpm dev`, `bun dev`).
- **Run migrations**: `npx prisma migrate dev` (see `prisma/migrations/`).
- **Import accounts**: Run `node scripts/import-accounts.js` to load CSV data.
- **PDF Generation**: Invoice PDFs are generated via API route at `src/app/api/invoice/[id]/pdf/route.js` and rendered with `src/components/InvoicePDF.jsx`.

## Project-Specific Conventions
- **File Naming**: API routes use `route.js`, UI pages use `page.jsx` or `page.js`.
- **Autocomplete**: Autocomplete components for accounts and client names are in `src/components/`.
- **Invoice Numbering**: Next invoice number logic is in `src/app/api/invoices/next-number/route.js`.
- **Status Types**: Invoice status types are managed via Prisma migrations.

## Integration Points
- **Prisma**: All DB access via Prisma client (`src/lib/prisma.js`).
- **CSV Import**: Accounts imported from `src/data/plan-comptable.csv` using `scripts/import-accounts.js`.
- **PDF**: Invoice PDFs generated server-side, downloaded via UI button.

## Examples
- To add a new API route for a resource, create a folder in `src/app/api/[resource]/[action]/route.js`.
- To update DB schema, edit `prisma/schema.prisma` and run migrations.
- To add a new UI page, create a folder in `src/app/[resource]/[action]/page.jsx`.

## References
- See `README.md` for basic setup and dev server instructions.
- See `prisma/schema.prisma` and `prisma/migrations/` for DB structure.
- See `src/lib/serverActions/` for shared business logic.

---

**Feedback requested:** Please review and suggest improvements or clarify any missing/unclear sections for your workflow.