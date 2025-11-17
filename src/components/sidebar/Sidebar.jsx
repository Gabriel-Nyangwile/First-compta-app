"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { featureFlags } from "@/lib/features";

function Badge({ count, color = "blue" }) {
  if (!count) return null;
  const map = {
    red: "bg-red-600",
    orange: "bg-orange-500",
    blue: "bg-blue-600",
    gray: "bg-gray-500",
  };
  return (
    <span
      className={`ml-2 inline-block ${
        map[color] || map.gray
      } text-white text-[10px] px-2 py-0.5 rounded-full`}
    >
      {count}
    </span>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [salesUnpaid, setSalesUnpaid] = useState(0);
  const [purchaseUnpaid, setPurchaseUnpaid] = useState(0);
  const [openMobile, setOpenMobile] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      setUser(raw ? JSON.parse(raw) : null);
    } catch {
      setUser(null);
    }
  }, []);
  useEffect(() => {
    let cancel = false;
    async function load() {
      try {
        const [a, b] = await Promise.all([
          fetch("/api/invoices/unpaid-count").then((r) =>
            r.ok ? r.json() : { count: 0 }
          ),
          fetch("/api/incoming-invoices/unpaid-count").then((r) =>
            r.ok ? r.json() : { count: 0 }
          ),
        ]);
        if (!cancel) {
          setSalesUnpaid(a.count || 0);
          setPurchaseUnpaid(b.count || 0);
        }
      } catch {}
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancel = true;
      clearInterval(id);
    };
  }, []);

  const navGroups = [
    // Groupes alignés sur AuthSidebar
    {
      title: "Comptabilité",
      items: [
        { href: "/journal", label: "Journal général" },
        { href: "/journal/od", label: "Journal OD" },
        { href: "/transactions", label: "Transactions" },
        { href: "/ledger", label: "Grand Livre" },
        {
          href: "/api/trial-balance?format=csv",
          label: "Export Balance",
          external: true,
        },
      ],
    },
    {
      title: "Analyse",
      items: [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/vat-recap", label: "Récap TVA" },
        { href: "/treasury", label: "Trésorerie" },
      ],
    },
    {
      title: "Ventes",
      items: [
        { href: "/clients", label: "Clients" },
        { href: "/clients/lettering", label: "Lettrage clients" },
        { href: "/sales-orders", label: "Commandes clients" },
        { href: "/invoices/create", label: "Créer facture", badge: salesUnpaid, badgeColor: "red" },
        { href: "/invoices", label: "Factures", badge: salesUnpaid, badgeColor: "red" },
        { href: "/products", label: "Produits" },
      ],
    },
    {
      title: "Achats",
      items: [
        { href: "/suppliers", label: "Fournisseurs" },
        { href: "/incoming-invoices/create", label: "Créer facture fournisseur", badge: purchaseUnpaid, badgeColor: "orange" },
        { href: "/incoming-invoices", label: "Factures fournisseurs", badge: purchaseUnpaid, badgeColor: "orange" },
        { href: "/suppliers/lettering", label: "Lettrage fournisseurs" },
        { href: "/purchase-orders", label: "Bons de commande" },
        { href: "/goods-receipts", label: "Réceptions" },
        { href: "/return-orders", label: "Retours fournisseurs" },
        { href: "/stock-withdrawals", label: "Sorties de stock" },
        { href: "/stock-ledger", label: "Ledger stock" },
        { href: "/stock-alerts", label: "Stock en alerte" },
        { href: "/inventory", label: "Inventaires" },
        { href: "/inventory/adjustments", label: "Ajustements stock" },
      ],
    },
    {
      title: "Trésorerie",
      items: [
        { href: "/authorizations?scope=CASH&flow=OUT", label: "Paiements caisse" },
        { href: "/authorizations?scope=CASH&flow=IN", label: "Encaissements caisse" },
        { href: "/authorizations?scope=BANK&flow=OUT", label: "Paiements banque" },
        { href: "/authorizations?scope=BANK&flow=IN", label: "Encaissements banque" },
        { href: "/treasury/suppliers", label: "Suivi fournisseurs" },
        { href: "/bank-advices", label: "Avis bancaires" },
        { href: "/treasury#transfers", label: "Transferts" },
      ],
    },
  ];

  // Intégration Paie (gated par feature flag)
  if (featureFlags.payroll) {
    navGroups.push({
      title: "Paie",
      items: [
        { href: "/payroll/periods", label: "Périodes" },
        { href: "/payroll/run", label: "Calcul / Exécution" },
        { href: "/payroll/employees", label: "Gestion du personnel" },
      ],
    });
  }

  const logout = () => {
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("user:logout"));
    window.location.href = "/?loggedout=1";
  };

  const Container = ({ children }) => (
    <aside
      className={`h-full flex flex-col bg-blue-950 text-white w-64 shrink-0 border-r border-blue-900 ${
        openMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      } transform transition-transform duration-200 fixed md:static z-40`}
    >
      {children}
    </aside>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-12 bg-blue-900 text-white flex items-center px-3 justify-between z-50 shadow">
        <button
          onClick={() => setOpenMobile((o) => !o)}
          className="px-2 py-1 border border-white/30 rounded text-sm"
        >
          {openMobile ? "Fermer" : "Menu"}
        </button>
        <Link href="/" className="font-semibold tracking-wide">
          Accueil
        </Link>
        <div className="text-xs opacity-80">{user?.username || ""}</div>
      </div>
      <Container>
        <div className="px-4 py-4 hidden md:flex items-center gap-2 border-b border-blue-900">
          <Link
            href="/"
            className="font-semibold tracking-wide text-white hover:text-blue-300"
          >
            Accueil
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto mt-12 md:mt-0 pb-6 space-y-6 px-3">
          {navGroups.map((g) => (
            <div key={g.title}>
              <div className="text-[11px] uppercase tracking-wide font-semibold text-blue-300/70 px-1 mb-1">
                {g.title}
              </div>
              <ul className="space-y-0.5">
                {g.items.map((it) => {
                  const active =
                    !it.external && pathname.startsWith(it.href.split("?")[0]);
                  const cls = `group flex items-center justify-between rounded px-3 py-1.5 text-sm cursor-pointer ${
                    active
                      ? "bg-blue-700 text-white"
                      : "text-blue-100 hover:bg-blue-800 hover:text-white"
                  }`;
                  const content = (
                    <>
                      <span>{it.label}</span>
                      {it.badge ? (
                        <Badge count={it.badge} color={it.badgeColor} />
                      ) : null}
                    </>
                  );
                  if (it.external)
                    return (
                      <li key={it.href}>
                        <a
                          href={it.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cls}
                        >
                          {content}
                        </a>
                      </li>
                    );
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        className={cls}
                        onClick={() => setOpenMobile(false)}
                      >
                        {content}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="px-3 py-3 border-t border-blue-900 text-xs flex flex-col gap-2">
          {user ? (
            <>
              <div className="opacity-80">Connecté: {user.username}</div>
              <button
                onClick={logout}
                className="text-left px-2 py-1 rounded bg-blue-800 hover:bg-blue-700 text-white text-xs"
              >
                Se déconnecter
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <Link
                href="/auth/signup"
                className="text-blue-200 hover:text-white"
              >
                Inscription
              </Link>
              <Link
                href="/auth/signin"
                className="text-blue-200 hover:text-white"
              >
                Connexion
              </Link>
            </div>
          )}
          <div className="text-[10px] opacity-40 pt-1">
            &copy; {new Date().getFullYear()}
          </div>
        </div>
      </Container>
      {/* Overlay for mobile */}
      {openMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setOpenMobile(false)}
        />
      )}
    </>
  );
}
