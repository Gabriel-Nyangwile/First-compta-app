"use client";

import { useEffect, useState } from "react";

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

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "", role: "VIEWER" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur chargement utilisateurs");
      setUsers(data.users || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Création échouée");
      setSuccess("Utilisateur créé");
      setForm({ username: "", email: "", password: "", role: "VIEWER" });
      await loadUsers();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h1 className="text-2xl font-bold">Gestion des utilisateurs</h1>
        <a
          href="/"
          className="px-3 py-2 rounded border border-gray-300 text-sm text-gray-700 hover:bg-gray-100"
        >
          ← Retour au menu
        </a>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <form onSubmit={handleSubmit} className="bg-white shadow p-4 rounded border">
          <h2 className="font-semibold mb-3">Créer un utilisateur</h2>
          <label className="f-label" htmlFor="username">Nom / pseudo</label>
          <input
            id="username"
            className="f-auth-input"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            required
          />
          <label className="f-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            className="f-auth-input"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
          <label className="f-label" htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            className="f-auth-input"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
          />
          <label className="f-label" htmlFor="role">Rôle</label>
          <select
            id="role"
            className="f-auth-input"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            {roles.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 mt-4 rounded">
            Créer
          </button>
          {error && <p className="text-red-600 mt-2">{error}</p>}
          {success && <p className="text-green-600 mt-2">{success}</p>}
        </form>

        <div className="bg-white shadow p-4 rounded border">
          <h2 className="font-semibold mb-3">Utilisateurs existants</h2>
          {loading ? <p>Chargement…</p> : null}
          {!loading && users.length === 0 ? <p>Aucun utilisateur.</p> : null}
          <ul className="divide-y divide-gray-200">
            {users.map((u) => (
              <li key={u.id} className="py-2">
                <div className="font-medium">{u.username || u.email}</div>
                <div className="text-sm text-gray-600">{u.email}</div>
                <div className="text-xs text-gray-500">Rôle : {u.role} — Créé le {new Date(u.createdAt).toLocaleDateString()}</div>
              </li>
            ))}
          </ul>
          {error && !loading ? <p className="text-red-600 mt-2">{error}</p> : null}
        </div>
      </div>
    </main>
  );
}
