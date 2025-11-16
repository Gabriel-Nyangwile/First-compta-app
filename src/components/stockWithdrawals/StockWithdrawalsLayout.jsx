export default function StockWithdrawalsLayout({ children }) {
  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Sorties de stock</h1>
        <p className="text-sm text-slate-600">
          Préparez les sorties pour la production, les ventes ou les échantillons
          et suivez leur statut jusqu&apos;à l&apos;enregistrement.
        </p>
      </header>
      <main>{children}</main>
    </div>
  );
}
