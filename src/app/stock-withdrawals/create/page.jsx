import Link from "next/link";
import StockWithdrawalForm from "@/components/stockWithdrawals/StockWithdrawalForm";

export const dynamic = "force-dynamic";

export default function StockWithdrawalCreatePage() {
  return (
    <section className="border border-slate-200 bg-white rounded px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <Link
          href="/stock-withdrawals"
          className="text-xs text-blue-600 underline hover:text-blue-800 transition-colors"
        >
          &larr; Retour aux sorties de stock
        </Link>
      </div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 mb-3">
        Nouvelle sortie de stock
      </h2>
      <StockWithdrawalForm />
    </section>
  );
}
