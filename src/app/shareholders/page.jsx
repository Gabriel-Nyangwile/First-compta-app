"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const EMPTY_FORM = {
  name: "",
  type: "INDIVIDUAL",
  email: "",
  phone: "",
  address: "",
};

export default function ShareholdersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState("");
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [forme, setForme] = useState("SARL");

  async function load() {
    setLoading(true);
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/shareholders", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Chargement échoué");
      setItems(Array.isArray(data.shareholders) ? data.shareholders : []);
    } catch (e) {
      setError(e.message || "Chargement échoué");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createItem(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    try {
      const res = await fetch("/api/shareholders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Création échouée");
      setForm(EMPTY_FORM);
      setInfo("Associé créé");
      await load();
    } catch (e) {
      setError(e.message || "Création échouée");
    }
  }

  async function saveItem() {
    if (!editId) return;
    setError("");
    setInfo("");
    try {
      const res = await fetch(`/api/shareholders/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Mise à jour échouée");
      setEditId("");
      setEditForm(EMPTY_FORM);
      setInfo("Associé mis à jour");
      await load();
    } catch (e) {
      setError(e.message || "Mise à jour échouée");
    }
  }

  async function deleteItem(id) {
    if (!confirm("Supprimer cet associé ?")) return;
    setError("");
    setInfo("");
    try {
      const res = await fetch(`/api/shareholders/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || "Suppression échouée");
      setInfo("Associé supprimé");
      await load();
    } catch (e) {
      setError(e.message || "Suppression échouée");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">{forme === "SA" ? "Actionnaires" : "Associés"}</h1>
          <p className="text-xs text-gray-500">
            {forme === "SA"
              ? "Forme SA : l’appellation Actionnaire s’applique."
              : "Forme SARL : l’appellation Associé s’applique."}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-gray-600">Forme</span>
            <select
              className="border rounded px-2 py-1"
              value={forme}
              onChange={(e) => setForme(e.target.value)}
            >
              <option value="SARL">SARL</option>
              <option value="SA">SA</option>
            </select>
          </label>
          <Link href="/capital-operations" className="text-blue-600 underline text-sm">
            Retour capital
          </Link>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {info && <div className="text-sm text-emerald-700">{info}</div>}

      <section className="border rounded-lg p-4 bg-white shadow-sm space-y-2">
        <div className="font-semibold text-sm">
          {forme === "SA" ? "Créer un actionnaire" : "Créer un associé"}
        </div>
        <form onSubmit={createItem} className="flex flex-wrap gap-2 text-sm items-end">
          <label className="space-y-1">
            <span>Nom</span>
            <input
              className="border rounded px-2 py-1 w-56"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="space-y-1">
            <span>Type</span>
            <select
              className="border rounded px-2 py-1"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="INDIVIDUAL">INDIVIDUAL</option>
              <option value="COMPANY">COMPANY</option>
            </select>
          </label>
          <label className="space-y-1">
            <span>Email</span>
            <input
              className="border rounded px-2 py-1 w-56"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              type="email"
            />
          </label>
          <label className="space-y-1">
            <span>Téléphone</span>
            <input
              className="border rounded px-2 py-1 w-40"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span>Adresse</span>
            <input
              className="border rounded px-2 py-1 w-64"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </label>
          <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
            Ajouter
          </button>
        </form>
      </section>

      <section className="border rounded-lg p-4 bg-white shadow-sm space-y-2">
        <div className="font-semibold text-sm">
          {forme === "SA" ? "Liste des actionnaires" : "Liste des associés"}
        </div>
        {loading ? (
          <div className="text-sm text-gray-500">Chargement...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-1 text-left">Nom</th>
                  <th className="px-3 py-1 text-left">Type</th>
                  <th className="px-3 py-1 text-left">Email</th>
                  <th className="px-3 py-1 text-left">Téléphone</th>
                  <th className="px-3 py-1 text-left">Adresse</th>
                  <th className="px-3 py-1 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-1">
                      {editId === it.id ? (
                        <input
                          className="border rounded px-2 py-1 w-48"
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        />
                      ) : (
                        it.name
                      )}
                    </td>
                    <td className="px-3 py-1">
                      {editId === it.id ? (
                        <select
                          className="border rounded px-2 py-1"
                          value={editForm.type}
                          onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                        >
                          <option value="INDIVIDUAL">INDIVIDUAL</option>
                          <option value="COMPANY">COMPANY</option>
                        </select>
                      ) : (
                        it.type
                      )}
                    </td>
                    <td className="px-3 py-1">
                      {editId === it.id ? (
                        <input
                          className="border rounded px-2 py-1 w-48"
                          value={editForm.email || ""}
                          onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        />
                      ) : (
                        it.email || "-"
                      )}
                    </td>
                    <td className="px-3 py-1">
                      {editId === it.id ? (
                        <input
                          className="border rounded px-2 py-1 w-32"
                          value={editForm.phone || ""}
                          onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                        />
                      ) : (
                        it.phone || "-"
                      )}
                    </td>
                    <td className="px-3 py-1">
                      {editId === it.id ? (
                        <input
                          className="border rounded px-2 py-1 w-64"
                          value={editForm.address || ""}
                          onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                        />
                      ) : (
                        it.address || "-"
                      )}
                    </td>
                    <td className="px-3 py-1 text-xs">
                      {editId === it.id ? (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                            onClick={saveItem}
                          >
                            Sauver
                          </button>
                          <button
                            type="button"
                            className="px-2 py-1 border rounded hover:bg-gray-50"
                            onClick={() => {
                              setEditId("");
                              setEditForm(EMPTY_FORM);
                            }}
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="px-2 py-1 border rounded hover:bg-gray-50"
                            onClick={() => {
                              setEditId(it.id);
                              setEditForm({
                                name: it.name || "",
                                type: it.type || "INDIVIDUAL",
                                email: it.email || "",
                                phone: it.phone || "",
                                address: it.address || "",
                              });
                            }}
                          >
                            Éditer
                          </button>
                          <button
                            type="button"
                            className="px-2 py-1 border rounded text-red-700 hover:bg-red-50"
                            onClick={() => deleteItem(it.id)}
                          >
                            Supprimer
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-center text-gray-500">
                      {forme === "SA" ? "Aucun actionnaire." : "Aucun associé."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
