import Link from "next/link";

const NAV_ITEMS = [
  {
    href: "/treasury",
    label: "Vue générale trésorerie",
    description: "Soldes, comptes, mouvements, avances et grand livre",
  },
  {
    href: "/authorizations",
    label: "Autorisations de trésorerie",
    description: "Toutes les autorisations de caisse et de banque",
  },
  {
    href: "/authorizations?scope=CASH&flow=OUT",
    label: "Décaissements caisse",
    description: "Paiements et sorties de caisse",
  },
  {
    href: "/authorizations?scope=CASH&flow=IN",
    label: "Encaissements caisse",
    description: "Recettes et entrées de caisse",
  },
  {
    href: "/authorizations?scope=BANK&flow=OUT",
    label: "Décaissements banque",
    description: "Paiements et sorties bancaires",
  },
  {
    href: "/authorizations?scope=BANK&flow=IN",
    label: "Encaissements banque",
    description: "Recettes et entrées bancaires",
  },
  {
    href: "/treasury/suppliers",
    label: "Règlements fournisseurs",
    description: "Encours, échéances et paiements fournisseurs",
  },
  {
    href: "/bank-advices",
    label: "Avis bancaires",
    description: "Saisir, consulter et exécuter les avis bancaires",
  },
  {
    href: "/treasury#transfers",
    label: "Transferts internes",
    description: "Transferts entre banques et caisses",
  },
];

function normalize(href) {
  return href.split("#")[0].split("?")[0];
}

export default function TreasuryModuleNav({ currentHref = "/treasury" }) {
  const currentBase = normalize(currentHref);

  return (
    <section className="bg-white border rounded p-4 space-y-3">
      <div>
        <h2 className="font-semibold">Navigation Trésorerie</h2>
        <p className="text-xs text-slate-500">
          Accès direct aux principaux écrans comptables du module.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {NAV_ITEMS.map((item) => {
          const active = normalize(item.href) === currentBase;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded border p-3 transition-colors ${
                active
                  ? "border-blue-300 bg-blue-50"
                  : "border-slate-200 bg-slate-50 hover:bg-slate-100"
              }`}
              prefetch={false}
            >
              <div className="text-sm font-medium text-slate-900">{item.label}</div>
              <div className="mt-1 text-xs text-slate-500">{item.description}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
