import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupForm() {
  const [form, setForm] = useState({ username: "", email: "", password: "", companyId: "" });
  const [companyRequest, setCompanyRequest] = useState({ requestedName: "", legalForm: "", currency: "CDF" });
  const [companies, setCompanies] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function loadCompanies() {
      try {
        const res = await fetch("/api/companies/public?context=signup", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setCompanies(data.companies || []);
      } catch {
        if (!cancelled) setCompanies([]);
      }
    }
    loadCompanies();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        companyRequest: form.companyId === "NEW" ? companyRequest : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Erreur inconnue");
    } else {
      setSuccess(data.message || "Demande d'inscription envoyée.");
      try {
        localStorage.setItem(
          "pendingAccessRequest",
          JSON.stringify({ message: data.message, request: data.request, createdAt: new Date().toISOString() }),
        );
        window.dispatchEvent(new Event("access:pending"));
      } catch {}
      setForm({ username: "", email: "", password: "", companyId: "" });
      setCompanyRequest({ requestedName: "", legalForm: "", currency: "CDF" });
      setTimeout(() => {
        router.push('/');
      }, 1500);
    }
  }

  // Si tentative non autorisée, on efface le message et on repart au menu après 10s
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => {
      setError("");
      router.push("/");
    }, 10000);
    return () => clearTimeout(t);
  }, [error, router]);

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6 bg-white">
      <h2 className="text-xl text-center font-bold mb-10">Inscription</h2>
      <p className="text-sm text-gray-600 mb-6">
        L'inscription crée une demande d'accès. Une réponse sera disponible dans le délai communiqué après validation.
      </p>
      <label htmlFor="companyId" className="f-label">Société demandée</label>
      <select
        id="companyId"
        className="f-auth-input"
        value={form.companyId}
        onChange={(e) => setForm((f) => ({ ...f, companyId: e.target.value }))}
        required
      >
        <option value="">-- Choisir --</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name} · {company.id.slice(0, 8)}
          </option>
        ))}
        <option value="NEW">Nouvelle société</option>
      </select>
      {form.companyId === "NEW" ? (
        <div className="border border-slate-200 rounded p-3 my-4">
          <label htmlFor="requestedName" className="f-label">Nom de la société</label>
          <input
            type="text"
            id="requestedName"
            name="requestedName"
            placeholder="Nom de la société"
            value={companyRequest.requestedName}
            onChange={(e) => setCompanyRequest((f) => ({ ...f, requestedName: e.target.value }))}
            className="f-auth-input"
            required
          />
          <label htmlFor="legalForm" className="f-label">Forme juridique</label>
          <input
            type="text"
            id="legalForm"
            name="legalForm"
            placeholder="SARL, SA..."
            value={companyRequest.legalForm}
            onChange={(e) => setCompanyRequest((f) => ({ ...f, legalForm: e.target.value }))}
            className="f-auth-input"
          />
          <label htmlFor="currency" className="f-label">Devise</label>
          <input
            type="text"
            id="currency"
            name="currency"
            value={companyRequest.currency}
            onChange={(e) => setCompanyRequest((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
            className="f-auth-input"
          />
        </div>
      ) : null}
      <label 
            htmlFor="userName"
            className='f-label'>Nom ou pseudo</label>
      <input
        type="text"
        id="userName"
        name="userName"
        placeholder="Nom ou pseudo de l'utilisateur"
        value={form.username}
        onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
        className="f-auth-input"
        required
      />
      <label 
            htmlFor="email"
            className='f-label'>Email</label>
      <input
        type="email"
        id="email"
        name="email"
        placeholder="Email"
        value={form.email}
        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
        className="f-auth-input"
        required
      />
      <label 
            htmlFor="password"
            className='f-label'>Mot de passe</label>
      <input
        type="password"
        id="password"
        name="password"
        placeholder="Mot de passe"
        value={form.password}
        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
        className="f-auth-input"
        required
      />
      <button 
        type="submit" className="w-full bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 my-10 rounded font-semibold">S'inscrire</button>
      <a 
            href="/auth/signin"
            className='mb-5 underline text-blue-600 block text-center'>
                Déjà inscrit ? Connectez-vous ! 
      </a>

      {error && <div className="text-red-600 mt-2">{error}</div>}
      {success && <div className="text-green-600 mt-2">{success}</div>}
    </form>
  );
}
