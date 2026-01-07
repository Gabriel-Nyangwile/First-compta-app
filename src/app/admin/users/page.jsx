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
  const [savingUserId, setSavingUserId] = useState(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);


  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('pageSize', pageSize);
      if (q) params.set('q', q);
      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        cache: "no-store",
        headers: { "x-user-role": process.env.NEXT_PUBLIC_DEFAULT_ROLE || "SUPERADMIN" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur chargement utilisateurs");
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  

  useEffect(() => {
    loadUsers();
  }, [q, page, pageSize]);

  async function deleteUser(id) {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    setError(""); setSuccess("");
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE", headers: { "x-user-role": process.env.NEXT_PUBLIC_DEFAULT_ROLE || "SUPERADMIN" } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Suppression échouée");
      setSuccess("Utilisateur supprimé");
      await loadUsers();
    } catch (e) { setError(e.message); }
  }

  async function updateUser(u) {
    setSavingUserId(u.id);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": process.env.NEXT_PUBLIC_DEFAULT_ROLE || "SUPERADMIN",
        },
        body: JSON.stringify({ role: u.role, isActive: u.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Maj utilisateur échouée");
      setSuccess("Utilisateur mis à jour");
      await loadUsers();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingUserId(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": process.env.NEXT_PUBLIC_DEFAULT_ROLE || "SUPERADMIN",
        },
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
          <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="border rounded px-2 py-1" placeholder="Rechercher email/nom" />
            <select className="border rounded px-2 py-1" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {[5,10,20,50].map(n => <option key={n} value={n}>{n}/page</option>)}
            </select>
            <button type="button" onClick={() => { setPage(1); loadUsers(); }} className="px-2 py-1 border rounded text-xs">Filtrer</button>
          </div>
          {loading ? <p>Chargement…</p> : null}
          {!loading && users.length === 0 ? <p>Aucun utilisateur.</p> : null}
          <ul className="divide-y divide-gray-200">
            {users.map((u) => (
              <li key={u.id} className="py-2">
                <div className="font-medium">{u.username || u.email}</div>
                <div className="text-sm text-gray-600">{u.email}</div>
                <div className="text-xs text-gray-500">Créé le {new Date(u.createdAt).toLocaleDateString()}</div>
                <div className="flex items-center gap-2 mt-2">
                  <select
                    className="border rounded px-2 py-1 text-xs"
                    value={u.role}
                    onChange={(e) => setUsers((list) => list.map((x) => x.id === u.id ? { ...x, role: e.target.value } : x))}
                  >
                    {roles.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={u.isActive}
                      onChange={(e) => setUsers((list) => list.map((x) => x.id === u.id ? { ...x, isActive: e.target.checked } : x))}
                    />
                    Actif
                  </label>
                  <button
                    type="button"
                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded disabled:opacity-50"
                    disabled={savingUserId === u.id}
                    onClick={() => updateUser(u)}
                  >
                    {savingUserId === u.id ? '...' : 'Sauver'}
                  </button>
                  <button type="button" className="px-2 py-1 border rounded text-xs" onClick={() => { const pwd = prompt('Nouveau mot de passe ?'); if (pwd) updateUser({ ...u, password: pwd }); }}>Reset MDP</button>
                  <button type="button" className="px-2 py-1 border rounded text-xs text-red-600" onClick={() => deleteUser(u.id)}>Supprimer</button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between text-xs mt-3">
            <span>Page {page} / {Math.max(1, Math.ceil(total / pageSize))} • {total} utilisateurs</span>
            <div className="flex items-center gap-1">
              <button type="button" className="px-2 py-1 border rounded" disabled={page<=1} onClick={() => setPage((p) => Math.max(1, p-1))}>Préc.</button>
              <button type="button" className="px-2 py-1 border rounded" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage((p) => p+1)}>Suiv.</button>
            </div>
          </div>
          {error && !loading ? <p className="text-red-600 mt-2">{error}</p> : null}
        </div>
      </div>
    </main>
  );
}
