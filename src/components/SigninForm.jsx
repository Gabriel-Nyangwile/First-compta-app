import { useRouter } from 'next/navigation';
import { useEffect, useState } from "react";

async function readJsonResponse(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export default function SigninForm() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [pendingCompanyId, setPendingCompanyId] = useState("");
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function loadCompanies() {
      try {
        const res = await fetch("/api/companies/public", { cache: "no-store" });
        const data = await readJsonResponse(res);
        if (!cancelled) setCompanies(data.companies || []);
        if (!cancelled && !res.ok) setError(data.error || "Impossible de charger les sociétés.");
      } catch {
        if (!cancelled) setCompanies([]);
        if (!cancelled) setError("Impossible de charger les sociétés.");
      }
    }
    const saved = localStorage.getItem("pendingCompanyId") || "";
    setPendingCompanyId(saved);
    loadCompanies();
    return () => { cancelled = true; };
  }, []);

  function setPending(id) {
    setPendingCompanyId(id);
    try {
      localStorage.setItem("pendingCompanyId", id);
    } catch {}
    document.cookie = `pending-company-id=${encodeURIComponent(id)}; path=/`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setUser(null);
    if (!pendingCompanyId) {
      setError("Sélectionnez la société (existante ou nouvelle) avant de vous connecter.");
      return;
    }
    const res = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, companyId: pendingCompanyId }),
    });
    const data = await readJsonResponse(res);
    if (!res.ok) {
      setError(data.error || "Erreur inconnue");
      router.push('/')
      
    } else {
      setUser(data.user);
      // Enregistre l'utilisateur dans le localStorage pour le layout global
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("userId", data.user.id);
      // Cookie simple pour le middleware RBAC (dev only)
      if (data.user?.role) {
        document.cookie = `user-role=${encodeURIComponent(data.user.role)}; path=/`;
      }
      if (data.user?.id) {
        document.cookie = `user-id=${encodeURIComponent(data.user.id)}; path=/`;
      }
      if (pendingCompanyId === "NEW") {
        document.cookie = "company-id=NEW; path=/";
        window.dispatchEvent(new Event('user:login'));
        setTimeout(() => {
          router.push(data.user?.canCreateCompany ? '/admin/companies?create=1' : '/company-request');
        }, 1000);
        return;
      }
      document.cookie = `company-id=${encodeURIComponent(pendingCompanyId)}; path=/`;
      window.dispatchEvent(new Event('user:login'));
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-36 p-6 ">
      <h2 className="text-xl text-center font-bold mb-10">Connexion</h2>
      <label htmlFor="companyPick" className="f-label">Société</label>
      <select
        id="companyPick"
        className="f-auth-input"
        value={pendingCompanyId}
        onChange={(e) => setPending(e.target.value)}
        required
      >
        <option value="">-- Choisir --</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} {c.legalForm ? `(${c.legalForm})` : ""}
          </option>
        ))}
        <option value="NEW">Nouvelle société</option>
      </select>
      <label htmlFor="email" className="f-label">
        Email
      </label>
      <input
        type="email"
        id="email"
        name="email"
        placeholder="Email"
        value={form.email}
        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        className="f-auth-input"
        required
      />
      <label htmlFor="password" className="f-label">
        Mot de passe
      </label>
      <input
        type="password"
        id="password"
        name="password"
        placeholder="Mot de passe"
        value={form.password}
        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
        className="f-auth-input"
        required
      />
      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-2 px-4 mt-6 mb-10 rounded border-none font-semibold"
      >
        Se connecter
      </button>

      {error && <div className="text-red-600 mt-2">{error}</div>}
      {user && (
        <div className="text-green-600 mt-2">
          Bienvenue, {user.username} !{" "}
          <button
            className="ml-4 text-blue-600 underline"
            onClick={() => {
              localStorage.removeItem("user");
              localStorage.removeItem("userId");
              setUser(null);
              document.cookie = "user-role=; path=/; Max-Age=0";
              document.cookie = "user-id=; path=/; Max-Age=0";
              window.location.reload();
            }}
          >
            Déconnexion
          </button>
        </div>
      )}
    </form>
  );
}
