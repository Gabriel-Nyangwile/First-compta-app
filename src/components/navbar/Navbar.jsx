"use client";
import Link from "next/link";
import { useState, useEffect } from "react";

// Navbar minimaliste: après authentification seule la racine (Accueil) et le nom d'utilisateur restent visibles.
// Toute la navigation fonctionnelle est déléguée à la sidebar contextuelle.
export default function Navbar() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [pendingCompanyId, setPendingCompanyId] = useState("");
  const [activeCompanyId, setActiveCompanyId] = useState("");

  useEffect(() => {
    let cancelled = false;
    const readCookie = (name) => {
      try {
        const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
        return match ? decodeURIComponent(match[1]) : "";
      } catch {
        return "";
      }
    };
    const finish = () => { if (!cancelled) setLoadingUser(false); };
    const readUser = () => {
      try {
        const raw = localStorage.getItem('user');
        if (!cancelled) setUser(raw ? JSON.parse(raw) : null);
        if (!cancelled) setActiveCompanyId(readCookie("company-id"));
      } catch {
        if (!cancelled) setUser(null);
        if (!cancelled) setActiveCompanyId("");
      } finally { finish(); }
    };
    readUser();
    // seconde passe après paint (ton pattern initial)
    requestAnimationFrame(readUser);
    const onStorage = (e) => { if (e.key === 'user') { setLoadingUser(true); readUser(); } };
    const onLogin = () => { setLoadingUser(true); readUser(); };
    const onLogout = () => { setLoadingUser(true); readUser(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('user:login', onLogin);
    window.addEventListener('user:logout', onLogout);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('user:login', onLogin);
      window.removeEventListener('user:logout', onLogout);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCompanies() {
      try {
        const res = await fetch("/api/companies/public", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) {
          setCompanies(data.companies || []);
        }
      } catch {
        if (!cancelled) setCompanies([]);
      }
    }
    loadCompanies();
    window.addEventListener("user:login", loadCompanies);
    const saved = localStorage.getItem("pendingCompanyId") || "";
    setPendingCompanyId(saved);
    return () => {
      cancelled = true;
      window.removeEventListener("user:login", loadCompanies);
    };
  }, []);

  function setPending(id) {
    setPendingCompanyId(id);
    try {
      localStorage.setItem("pendingCompanyId", id);
    } catch {}
    document.cookie = `pending-company-id=${encodeURIComponent(id)}; path=/`;
  }

  const activeCompanyName = (() => {
    if (!activeCompanyId) return "";
    if (activeCompanyId === "NEW") return "Nouvelle société";
    const membershipMatch = user?.memberships?.find?.((item) => item.companyId === activeCompanyId);
    if (membershipMatch?.companyName) return membershipMatch.companyName;
    const publicMatch = companies.find((item) => item.id === activeCompanyId);
    if (publicMatch?.name) return publicMatch.name;
    return "Société active";
  })();
  const canSwitchCompany =
    !!user && ["PLATFORM_ADMIN", "SUPERADMIN"].includes(user.role?.toString?.().toUpperCase());

  function switchActiveCompany(id) {
    setActiveCompanyId(id);
    setPending(id);
    if (id) {
      document.cookie = `company-id=${encodeURIComponent(id)}; path=/`;
      try {
        const nextCompany = companies.find((company) => company.id === id);
        const nextUser = {
          ...user,
          companyId: id,
          memberships: user?.memberships?.some?.((item) => item.companyId === id)
            ? user.memberships
            : [
                ...(user?.memberships || []),
                { companyId: id, companyName: nextCompany?.name || "Société active", role: user.role, isDefault: false },
              ],
        };
        localStorage.setItem("user", JSON.stringify(nextUser));
        setUser(nextUser);
      } catch {}
    }
    window.dispatchEvent(new Event("user:login"));
  }

  const UserSlot = () => {
    if (loadingUser) {
      return (
        <span
          aria-hidden="true"
          className="skeleton-inline skeleton-animated h-4 w-24 sm:w-28"
          style={{ background: 'rgba(255,255,255,0.28)' }}
        />
      );
    }
    if (!user) {
      return (
        <>
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <label htmlFor="companyPick" className="opacity-80">Société</label>
            <select
              id="companyPick"
              className="bg-blue-950/40 border border-blue-700/50 rounded px-2 py-1 text-xs"
              value={pendingCompanyId}
              onChange={(e) => setPending(e.target.value)}
            >
              <option value="">-- Choisir --</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.legalForm ? `(${c.legalForm})` : ""}
                </option>
              ))}
              <option value="NEW">Nouvelle société</option>
            </select>
          </div>
          <Link href="/auth/signup" className="hover:text-blue-300">Inscription</Link>
          <Link href="/auth/signin" className="hover:text-blue-300">Connexion</Link>
        </>
      );
    }
    return (
      <div className="flex items-center gap-3">
        {canSwitchCompany && companies.length ? (
          <select
            className="hidden sm:inline-flex max-w-[260px] rounded-full border border-blue-700/60 bg-blue-950/50 px-3 py-1 text-xs text-blue-100"
            value={activeCompanyId || ""}
            onChange={(event) => switchActiveCompany(event.target.value)}
            title="Changer de société active"
          >
            <option value="">Société...</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        ) : activeCompanyName ? (
          <span
            className="hidden sm:inline-flex items-center rounded-full bg-blue-950/50 border border-blue-700/60 px-3 py-1 text-xs text-blue-100 max-w-[260px] truncate"
            title={activeCompanyName}
          >
            Société: {activeCompanyName}
          </span>
        ) : null}
        <span
          className="text-xs sm:text-sm opacity-80 truncate max-w-[140px]"
          title={user.username}
        >
          {user.username}
        </span>
      </div>
    );
  };

  return (
    <nav className="w-full bg-blue-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between shadow fixed top-0 left-0 z-50">
      <div className="flex items-center gap-4 sm:gap-5 flex-wrap">
        <Link href="/" className="font-semibold tracking-wide hover:text-blue-300">Accueil</Link>
      </div>
      <div className="flex items-center gap-3 sm:gap-4 text-sm min-h-[1rem]">
        <UserSlot />
      </div>
    </nav>
  );
}
