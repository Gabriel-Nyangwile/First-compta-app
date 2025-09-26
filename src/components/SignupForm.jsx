import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupForm() {
  const [form, setForm] = useState({ username: "", email: "", password: "" });
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
      setError(data.error || "Erreur inconnue");
    } else {
      setSuccess("Inscription réussie !");
      setForm({ username: "", email: "", password: "" });
      setTimeout(() => {
        router.push('/auth/signin');
      }, 3000);
    }
  }

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
