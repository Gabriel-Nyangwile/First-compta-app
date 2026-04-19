import Link from "next/link";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { getCompanyIdFromCookies } from "@/lib/tenant";
import ManualOdForm from "@/components/journal/ManualOdForm";

export default async function ManualOdPage() {
  const cookieStore = await cookies();
  const companyId = getCompanyIdFromCookies(cookieStore);

  if (!companyId) {
    return (
      <div className="px-6 py-8">
        companyId requis (cookie company-id ou DEFAULT_COMPANY_ID).
      </div>
    );
  }

  const accounts = await prisma.account.findMany({
    where: { companyId },
    orderBy: { number: "asc" },
    select: { id: true, number: true, label: true },
  });

  return (
    <div className="px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Journal des opérations diverses manuelles
          </h1>
          <p className="text-sm text-neutral-500">
            Saisie libre d&apos;une écriture équilibrée avec accès à tous les
            comptes du plan comptable.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link
            className="rounded border border-neutral-300 px-3 py-2 hover:bg-neutral-100"
            href="/journal/manual-od/pending"
          >
            Brouillons à valider
          </Link>
          <Link
            className="rounded border border-neutral-300 px-3 py-2 hover:bg-neutral-100"
            href="/journal"
          >
            Retour journal
          </Link>
          <Link
            className="rounded border border-neutral-300 px-3 py-2 hover:bg-neutral-100"
            href="/journal/od"
          >
            OD auto orphelins
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Ce formulaire crée un journal manuel distinct du mécanisme automatique
        de rattachement des orphelins. Chaque ligne est enregistrée comme
        transaction d&apos;ajustement dans une écriture numérotée
        automatiquement. Une référence justificative peut être saisie pour
        faciliter le contrôle et l&apos;audit.
      </div>

      <ManualOdForm accounts={accounts} />
    </div>
  );
}
