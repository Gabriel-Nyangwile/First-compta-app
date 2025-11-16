export default function ReturnOrdersLayout({ children }) {
  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Retours fournisseurs</h1>
        <p className="text-sm text-slate-600">
          Gérez les retours de marchandises auprès des fournisseurs et suivez
          les statuts d&apos;envoi.
        </p>
      </header>
      <main>{children}</main>
    </div>
  );
}
