import { useRouter } from 'next/navigation';
import { useState } from "react";

export default function SigninForm() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setUser(null);
    const params = new URLSearchParams(form).toString();
    const res = await fetch(`/api/auth?${params}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Erreur inconnue");
      router.push('/')
      
    } else {
      setUser(data.user);
      // Enregistre l'utilisateur dans le localStorage pour le layout global
      localStorage.setItem("user", JSON.stringify(data.user));
      // Cookie simple pour le middleware RBAC (dev only)
      if (data.user?.role) {
        document.cookie = `user-role=${encodeURIComponent(data.user.role)}; path=/`;
      }
      window.dispatchEvent(new Event('user:login'));
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-36 p-6 ">
      <h2 className="text-xl text-center font-bold mb-10">Connexion</h2>
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
              setUser(null);
              document.cookie = "user-role=; path=/; Max-Age=0";
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
