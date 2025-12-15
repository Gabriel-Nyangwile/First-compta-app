import { useState } from "react";
import { useRouter } from "next/navigation";

const roles = [
  { value: "VIEWER", label: "Viewer (lecture seule)" },
  { value: "ACCOUNTANT", label: "Comptable" },
  { value: "FINANCE_MANAGER", label: "Responsable finance" },
  { value: "PROCUREMENT", label: "Achats" },
  { value: "SALES", label: "Ventes" },
  { value: "HR_MANAGER", label: "RH / Manager" },
  { value: "PAYROLL_CLERK", label: "Paie" },
  { value: "TREASURY", label: "Trésorerie" },
  { value: "SUPERADMIN", label: "Super admin" },
];

export default function SignupForm() {
  const [form, setForm] = useState({ username: "", email: "", password: "", role: "VIEWER" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Erreur inconnue (vérifiez le jeton d'admin)");
    } else {
      setSuccess("Inscription réussie !");
      setForm({ username: "", email: "", password: "", role: "VIEWER" });
      setTimeout(() => {
        router.push('/auth/signin');
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
      <label htmlFor="role" className="f-label">Rôle</label>
      <select
        id="role"
        name="role"
        className="f-auth-input"
        value={form.role}
        onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
      >
        {roles.map(r => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
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
