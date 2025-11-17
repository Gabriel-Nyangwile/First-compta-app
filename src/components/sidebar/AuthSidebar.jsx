"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { featureFlags } from "@/lib/features";

// Private route prefixes (adjust as needed)
const PRIVATE_PREFIXES = [
  "/dashboard",
  "/journal",
  "/transactions",
  "/ledger",
  "/invoices",
  "/incoming-invoices",
  "/clients",
  "/suppliers",
  "/purchase-orders",
  "/goods-receipts",
  "/treasury",
  "/authorizations",
  "/bank-advices",
  "/products",
  "/payroll",
];

const GROUPS = [
  {
    key: "perso",
    label: "Gestion du personnel",
    items: [
      { href: "/employee", label: "Employés" },
      { href: "/position", label: "Postes" },
      { href: "/bareme", label: "Barèmes" },
      { href: "/contract", label: "Contrats" },
      { href: "/employee-history", label: "Historique employés" },
    ],
  },
  {
    key: "comp",
    label: "Comptabilité",
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
    key: "anal",
    label: "Analyse",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/vat-recap", label: "Récap TVA" },
      { href: "/treasury", label: "Trésorerie" },
    ],
  },
  {
    key: "vent",
    label: "Ventes",
    items: [
      { href: "/clients", label: "Clients" },
      { href: "/clients/lettering", label: "Lettrage clients" },
      { href: "/sales-orders", label: "Commandes clients" },
      { href: "/invoices/create", label: "Créer facture", badge: "sales" },
      { href: "/invoices", label: "Factures", badge: "sales" },
      { href: "/products", label: "Produits" },
    ],
  },
  {
    key: "achat",
    label: "Achats",
    items: [
      { href: "/suppliers", label: "Fournisseurs" },
      {
        href: "/incoming-invoices/create",
        label: "Créer facture fournisseur",
        badge: "purch",
      },
      {
        href: "/incoming-invoices",
        label: "Factures fournisseurs",
        badge: "purch",
      },
  // Lien lettrage fournisseurs (clé unique)
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
    key: "tres",
    label: "Trésorerie",
    items: [
      {
        href: "/authorizations?scope=CASH&flow=OUT",
        label: "Paiements caisse",
      },
      {
        href: "/authorizations?scope=CASH&flow=IN",
        label: "Encaissements caisse",
      },
      {
        href: "/authorizations?scope=BANK&flow=OUT",
        label: "Paiements banque",
      },
      {
        href: "/authorizations?scope=BANK&flow=IN",
        label: "Encaissements banque",
      },
      { href: "/treasury/suppliers", label: "Suivi fournisseurs" },
      { href: "/bank-advices", label: "Avis bancaires" },
      { href: "/treasury#transfers", label: "Transferts" },
    ],
  },
];

// Icônes minimalistes statiques (évite un hook useMemo supplémentaire variable selon early return)
const ICONS = {
  comp: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="opacity-80"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  anal: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="opacity-80"
    >
      <path d="M3 17h2v2H3zM7 13h2v6H7zM11 9h2v10h-2zM15 5h2v14h-2zM19 3h2v16h-2z" />
    </svg>
  ),
  vent: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="opacity-80"
    >
      <path d="M3 12h18" />
      <path d="M7 8h10" />
      <path d="M10 16h4" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  achat: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="opacity-80"
    >
      <path d="M6 6h15l-1.5 9h-13z" />
      <path d="M6 6L5 3H3" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="17" cy="19" r="1" />
    </svg>
  ),
  tres: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="opacity-80"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 15h.01" />
      <path d="M12 15h.01" />
      <path d="M16 15h.01" />
    </svg>
  ),
};

function Badge({ count, color }) {
  if (!count) return null;
  const cls =
    color === "red"
      ? "bg-red-600"
      : color === "orange"
      ? "bg-orange-500"
      : "bg-blue-600";
  return (
    <span
      className={`ml-2 inline-block ${cls} text-white text-[10px] px-1.5 py-0.5 rounded-full`}
    >
      {count}
    </span>
  );
}

export default function AuthSidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [initialPhase, setInitialPhase] = useState(true); // conservé pour éventuel futur effet visuel, mais n'influencera plus la fermeture
  const [pinned, setPinned] = useState(false);
  const [salesUnpaid, setSalesUnpaid] = useState(0);
  const [purchaseUnpaid, setPurchaseUnpaid] = useState(0);
  const sideRef = useRef(null);
  const isPrivate = PRIVATE_PREFIXES.some((p) => pathname.startsWith(p));
  const logout = () => {
    try {
      localStorage.removeItem("user");
    } catch {}
    window.dispatchEvent(new Event("user:logout"));
    window.location.href = "/?loggedout=1";
  };

  // detect user
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem("user");
        setUser(raw ? JSON.parse(raw) : null);
      } catch {
        setUser(null);
      }
    };
    read();
    const onLogin = () => {
      read();
      // Au login: si aucune préférence, afficher sidebar brièvement
      try {
        const savedPinned = localStorage.getItem("sidebarPinned");
        if (savedPinned === "true") setPinned(true);
        const savedExpanded = localStorage.getItem("sidebarExpanded");
        if (savedExpanded === "true" || savedExpanded === "false") {
          setExpanded(savedExpanded === "true");
        } else {
          setExpanded(true); // montrer
          setTimeout(() => {
            if (!pinned) setExpanded(false);
          }, 3500);
        }
      } catch {}
      setInitialPhase(false);
    };
    const onLogout = () => {
      setUser(null);
    };
    window.addEventListener("user:login", onLogin);
    window.addEventListener("user:logout", onLogout);
    return () => {
      window.removeEventListener("user:login", onLogin);
      window.removeEventListener("user:logout", onLogout);
    };
  }, []);

  // Lecture préférence sidebar (persistée) + défaut: ouverte sur desktop, fermée sur mobile.
  useEffect(() => {
    if (!user) {
      setExpanded(false);
      return;
    }
    try {
      const saved = localStorage.getItem("sidebarExpanded");
      const savedPinned = localStorage.getItem("sidebarPinned");
      if (savedPinned === "true") setPinned(true);
      if (saved === "true" || saved === "false") {
        setExpanded(saved === "true");
      } else {
        // heuristique : ouvrir par défaut sur large écrans
        if (window.matchMedia("(min-width: 768px)").matches) {
          setExpanded(true);
          // auto-réduction après délai si non pin
          setTimeout(() => {
            if (!pinned) setExpanded(false);
          }, 2500);
        }
      }
    } catch {}
  }, [user, pinned]);

  // counts (uniquement si user)
  useEffect(() => {
    if (!user) return;
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
  }, [user]);

  // Auto-hide / auto-show sur desktop non tactile si non épinglé.
  useEffect(() => {
    if (!user) return;
    if (pinned) return; // ne rien faire si épinglé
    const mqFine = window.matchMedia("(pointer:fine)");
    if (!mqFine.matches) return; // ignorer écrans tactiles purs
    function onMove(e) {
      if (!sideRef.current) return;
      const rect = sideRef.current.getBoundingClientRect();
      // Si souris proche du bord gauche -> ouvrir
      if (!expanded && e.clientX < 24) {
        setExpanded(true);
        return;
      }
      // Si ouverte et curseur assez loin -> refermer
      if (expanded && e.clientX > rect.right + 80) {
        setExpanded(false);
      }
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [expanded, pinned, user]);

  // Lorsque navigation vers une route privée et non épinglé : flash d'ouverture courte pour signaler navigation
  useEffect(() => {
    if (user && isPrivate && !pinned) {
      setExpanded(true);
      const id = setTimeout(() => setExpanded(false), 1800);
      return () => clearTimeout(id);
    }
  }, [pathname, user, isPrivate, pinned]);

  // Bouton mobile (rendu même si user chargé pour garantir un point d'entrée tactile)
  // On ne rend rien pour users non connectés (cohérent avec ancienne logique)
  if (!user) return null;

  const width = expanded ? "w-64" : "w-12";
  const transition = "transition-all duration-300";
  const itemBase =
    "flex items-center text-sm rounded px-2 py-1.5 hover:bg-blue-700/60";

  // Groupes dynamiques avec feature flags (Paie)
  const allGroups = featureFlags.payroll
    ? [
        ...GROUPS,
        {
          key: "paie",
          label: "Paie",
          items: [
            { href: "/payroll/periods", label: "Périodes" },
            { href: "/payroll/run", label: "Calcul / Exécution" },
            { href: "/payroll/employees", label: "Gestion du personnel" },
          ],
        },
      ]
    : GROUPS;

  function renderGroup(g) {
    if (!expanded) return null;
    return (
      <div key={g.key} id={`grp-${g.key}`} className="animate-slideFadeIn">
        <div className="text-[11px] uppercase tracking-wide text-blue-300/70 px-2 mt-4 mb-1">
          {g.label}
        </div>
        <ul className="space-y-0.5">
          {g.items.map((it) => renderLink(it, false))}
        </ul>
      </div>
    );
  }

  function renderLink(it, insidePopover) {
    const active = !it.external && pathname.startsWith(it.href.split("?")[0]);
    let badgeCount = 0;
    let badgeColor;
    if (it.badge === "sales") {
      badgeCount = salesUnpaid;
      badgeColor = "red";
    }
    if (it.badge === "purch") {
      badgeCount = purchaseUnpaid;
      badgeColor = "orange";
    }
    const cls = `${itemBase} ${
      active ? "bg-blue-700 text-white" : "text-blue-100 hover:text-white"
    } ${insidePopover ? "" : "pl-3"}`;
    const content = (
      <>
        <span>{it.label}</span>
        {badgeCount ? <Badge count={badgeCount} color={badgeColor} /> : null}
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
        <Link href={it.href} className={cls}>
          {content}
        </Link>
      </li>
    );
  }

  return (
    <>
      {/* Bouton mobile persistent (md:hidden) */}
      <button
        type="button"
        aria-label={
          expanded ? "Fermer le menu navigation" : "Ouvrir le menu navigation"
        }
        onClick={() =>
          setExpanded((e) => {
            try {
              localStorage.setItem("sidebarExpanded", (!e).toString());
            } catch {}
            return !e;
          })
        }
        className="md:hidden fixed left-3 top-[5.2rem] z-50 bg-blue-900 text-white rounded-full shadow px-3 py-2 text-xs active:scale-95 transition"
      >
        {expanded ? "Fermer" : "Menu"}
      </button>
      {/* Poignée (gutter) desktop quand replié */}
      {!expanded && user && (
        <div className="hidden md:flex fixed left-0 top-20 h-[calc(100vh-5rem)] z-30">
          {/* Barre étroite cliquable + rail d'icônes */}
          <div
            onMouseEnter={() => {
              if (!pinned) setExpanded(true);
            }}
            onClick={() => setExpanded(true)}
            className="w-2 bg-blue-900/20 hover:bg-blue-700/60 cursor-pointer rounded-tr rounded-br transition-colors"
            title="Ouvrir le menu"
          />
          <div className="flex flex-col items-center gap-3 ml-1 py-3 px-1 bg-blue-950/70 backdrop-blur-sm border-r border-blue-900 rounded-tr-lg rounded-br-lg shadow-inner">
            {allGroups.map((g) => (
              <button
                key={g.key}
                onClick={() => {
                  setExpanded(true);
                  setTimeout(() => {
                    const el = document.getElementById(`grp-${g.key}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 60);
                }}
                className="text-blue-200 hover:text-white focus:outline-none focus:ring-1 focus:ring-blue-400 p-1.5 rounded hover:bg-blue-800/60"
                aria-label={g.label}
                title={g.label}
              >
                {ICONS[g.key] || g.label[0]}
              </button>
            ))}
            <button
              onClick={() => {
                setPinned((p) => {
                  const nv = !p;
                  try {
                    localStorage.setItem("sidebarPinned", nv.toString());
                  } catch {}
                  return nv;
                });
              }}
              className={`mt-auto text-[10px] px-2 py-1 rounded ${
                pinned
                  ? "bg-blue-700 text-white"
                  : "bg-blue-800/70 text-blue-200 hover:bg-blue-700/80"
              }`}
              aria-label={
                pinned ? "Dépingler la sidebar" : "Épingler la sidebar"
              }
              title={pinned ? "Dépingler" : "Épingler"}
            >
              {pinned ? "📌" : "📍"}
            </button>
          </div>
        </div>
      )}
      {expanded && (
        <div
          ref={sideRef}
          className={`fixed left-0 top-20 h-[calc(100vh-5rem)] bg-blue-950/95 backdrop-blur-sm border-r border-blue-900 text-white flex flex-col overflow-y-auto ${width} ${transition} z-40 rounded-tr-lg rounded-br-lg shadow-lg`}
          style={{ clipPath: "inset(0 0 0 0)" }}
        >
          <div className="flex items-center justify-between px-2 py-2 border-b border-blue-800/50">
            <div className="text-[11px] font-semibold tracking-wide text-blue-200 truncate pr-2">
              Navigation
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setPinned((p) => {
                    const nv = !p;
                    try {
                      localStorage.setItem("sidebarPinned", nv.toString());
                    } catch {}
                    return nv;
                  });
                }}
                className={`text-[10px] px-2 py-1 rounded border border-blue-600/40 ${
                  pinned
                    ? "bg-blue-700 text-white"
                    : "bg-blue-800/60 text-blue-100 hover:bg-blue-700"
                }`}
                title={
                  pinned
                    ? "Dépingler (retour auto-hide)"
                    : "Épingler la sidebar"
                }
              >
                {pinned ? "Épinglée" : "Épingler"}
              </button>
              <button
                onClick={() => {
                  setExpanded(false);
                  try {
                    localStorage.setItem("sidebarExpanded", "false");
                  } catch {}
                }}
                className="text-[10px] px-2 py-1 rounded bg-blue-800 hover:bg-blue-700"
                title="Réduire"
              >
                ×
              </button>
            </div>
          </div>
          <div className="flex-1 px-1 space-y-2 overflow-y-auto transition-opacity duration-300 opacity-100">
            {allGroups.map(renderGroup)}
          </div>
          <div className="flex flex-col gap-2 px-2 mb-2 pt-2 border-t border-blue-800/40">
            <div className="text-[11px] text-blue-300/60 truncate px-1">
              {user?.username}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPinned((p) => {
                    const nv = !p;
                    try {
                      localStorage.setItem("sidebarPinned", nv.toString());
                    } catch {}
                    return nv;
                  });
                }}
                className={`flex-1 text-xs px-2 py-1 rounded ${
                  pinned ? "bg-blue-700" : "bg-blue-800 hover:bg-blue-700"
                } text-left`}
              >
                {pinned ? "Dépingler" : "Épingler"}
              </button>
              <button
                onClick={logout}
                className="text-xs px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-left"
              >
                Quitter
              </button>
            </div>
          </div>
          {!pinned && (
            <div className="p-2 pt-0 text-[10px] text-blue-300/40 hidden md:block animate-slideFadeIn">
              Auto-hide actif (épingler pour fixer).
            </div>
          )}
        </div>
      )}
    </>
  );
}
