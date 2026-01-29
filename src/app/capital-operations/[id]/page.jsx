"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function Section({ title, children, id }) {
  return (
    <section id={id} className="border rounded-lg p-4 bg-white shadow-sm space-y-2">
      <div className="font-semibold text-sm">{title}</div>
      {children}
    </section>
  );
}

export default function CapitalOperationDetail({ params }) {
  const [opId, setOpId] = useState(null);
  const [op, setOp] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);

  const [subForm, setSubForm] = useState({
    shareholderId: "",
    nominalAmount: "",
    premiumAmount: "",
    sharesCount: "",
  });

  const [callForm, setCallForm] = useState({
    subscriptionId: "",
    amountCalled: "",
    dueDate: "",
    label: "",
  });

  const [payForm, setPayForm] = useState({ amount: "", paymentDate: "", method: "BANK" });
  const [selectedCall, setSelectedCall] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [shareholders, setShareholders] = useState([]);
  const [shForm, setShForm] = useState({ name: "", type: "INDIVIDUAL", email: "" });
  const [editShId, setEditShId] = useState("");
  const [editShForm, setEditShForm] = useState({
    name: "",
    type: "INDIVIDUAL",
    email: "",
    phone: "",
    address: "",
  });
  const [editSubId, setEditSubId] = useState("");
  const [editSubForm, setEditSubForm] = useState({
    nominalAmount: "",
    premiumAmount: "",
    sharesCount: "",
    note: "",
  });
  const [editCallId, setEditCallId] = useState("");
  const [editCallForm, setEditCallForm] = useState({
    amountCalled: "",
    dueDate: "",
    label: "",
    subscriptionId: "",
  });

  const totalCalled = op?.calls?.reduce((s, c) => s + Number(c.amountCalled || 0), 0) || 0;
  const totalPaid =
    op?.calls?.reduce(
      (s, c) =>
        s +
        (c.payments || []).reduce((p, pay) => p + Number(pay.amount || 0), 0),
      0
    ) || 0;
  const target = Number(op?.nominalTarget || 0);
  const remainingToCall = Math.max(0, target - totalCalled);
  const remainingToPay = Math.max(0, totalCalled - totalPaid);

  useEffect(() => {
    let active = true;
    Promise.resolve(params)
      .then((p) => {
        if (active) setOpId(p?.id);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [params]);

  async function load() {
    setLoading(true);
    setError("");
    setInfo("");
    try {
      if (!opId) throw new Error("Paramètre id requis");
      const [opRes, shRes, accRes] = await Promise.all([
        fetch(`/api/capital-operations/${opId}`, { cache: "no-store" }),
        fetch("/api/shareholders", { cache: "no-store" }),
        fetch("/api/accounts", { cache: "no-store" }),
      ]);
      const opData = await opRes.json();
      if (!opRes.ok) throw new Error(opData.error || "Erreur chargement opération");
      setOp(opData);
      const shData = await shRes.json().catch(() => ({}));
      setShareholders(Array.isArray(shData.shareholders) ? shData.shareholders : []);
      const accData = await accRes.json().catch(() => ({}));
      setAccounts(Array.isArray(accData) ? accData : Array.isArray(accData.accounts) ? accData.accounts : []);
    } catch (e) {
      setError(e.message || "Erreur chargement");
      setInfo("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (opId) load();
  }, [opId]);

  async function createSubscription(e) {
    e.preventDefault();
    setError("");
    try {
      if (!opId) throw new Error("Paramètre id requis");
      const res = await fetch(`/api/capital-operations/${opId}/subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...subForm,
          nominalAmount: subForm.nominalAmount ? Number(subForm.nominalAmount) : undefined,
          premiumAmount: subForm.premiumAmount ? Number(subForm.premiumAmount) : undefined,
          sharesCount: subForm.sharesCount ? Number(subForm.sharesCount) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur souscription");
      setSubForm({ shareholderId: "", nominalAmount: "", premiumAmount: "", sharesCount: "" });
      await load();
    } catch (e) {
      setError(e.message || "Erreur souscription");
    }
  }

  async function createCall(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/capital-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capitalOperationId: opId,
          subscriptionId: callForm.subscriptionId || undefined,
          amountCalled: callForm.amountCalled ? Number(callForm.amountCalled) : undefined,
          dueDate: callForm.dueDate || undefined,
          label: callForm.label || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur appel de fonds");
      setCallForm({ subscriptionId: "", amountCalled: "", dueDate: "", label: "" });
      await load();
    } catch (e) {
      setError(e.message || "Erreur appel de fonds");
    }
  }

  async function payCall(e) {
    e.preventDefault();
    if (!selectedCall) return;
    setError("");
    try {
      const res = await fetch(`/api/capital-calls/${selectedCall}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: payForm.amount ? Number(payForm.amount) : undefined,
          paymentDate: payForm.paymentDate || undefined,
          method: payForm.method || "BANK",
          accountId: payForm.accountId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur paiement");
      setPayForm({ amount: "", paymentDate: "", method: "BANK" });
      setSelectedCall(null);
      await load();
    } catch (e) {
      setError(e.message || "Erreur paiement");
    }
  }

  async function updateCall(callId) {
    if (!callId) return;
    setError("");
    try {
      const res = await fetch(`/api/capital-calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCalled: editCallForm.amountCalled ? Number(editCallForm.amountCalled) : undefined,
          dueDate: editCallForm.dueDate || undefined,
          label: editCallForm.label || undefined,
          subscriptionId: editCallForm.subscriptionId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur mise à jour appel");
      setEditCallId("");
      setEditCallForm({ amountCalled: "", dueDate: "", label: "", subscriptionId: "" });
      await load();
    } catch (e) {
      setError(e.message || "Erreur mise à jour appel");
    }
  }

  async function createShareholder(e) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/shareholders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur création associé/actionnaire");
      setShForm({ name: "", type: "INDIVIDUAL", email: "" });
      setSubForm((f) => ({ ...f, shareholderId: data.id }));
      await load();
    } catch (e) {
      setError(e.message || "Erreur création associé/actionnaire");
    }
  }

  async function updateShareholder(e) {
    e.preventDefault();
    if (!editShId) return;
    setError("");
    try {
      const res = await fetch(`/api/shareholders/${editShId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editShForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur mise à jour associé/actionnaire");
      setEditShId("");
      setEditShForm({ name: "", type: "INDIVIDUAL", email: "", phone: "", address: "" });
      await load();
    } catch (e) {
      setError(e.message || "Erreur mise à jour associé/actionnaire");
    }
  }

  async function updateSubscription(subId) {
    if (!subId) return;
    setError("");
    try {
      const res = await fetch(`/api/capital-subscriptions/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nominalAmount: editSubForm.nominalAmount ? Number(editSubForm.nominalAmount) : undefined,
          premiumAmount: editSubForm.premiumAmount ? Number(editSubForm.premiumAmount) : undefined,
          sharesCount: editSubForm.sharesCount ? Number(editSubForm.sharesCount) : undefined,
          note: editSubForm.note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur mise à jour souscription");
      setEditSubId("");
      setEditSubForm({ nominalAmount: "", premiumAmount: "", sharesCount: "", note: "" });
      await load();
    } catch (e) {
      setError(e.message || "Erreur mise à jour souscription");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Opération de capital</h1>
          {op && (
            <p className="text-sm text-gray-600">
              {op.ref} · {op.type} · {op.form} · Statut {op.status}
            </p>
          )}
        </div>
        <Link href="/capital-operations" className="text-blue-600 underline text-sm">
          ← Retour
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <a href="#details" className="px-2 py-1 border rounded hover:bg-gray-50">
          Détails
        </a>
        <a href="#subscriptions" className="px-2 py-1 border rounded hover:bg-gray-50">
          Souscriptions
        </a>
        <a href="#calls" className="px-2 py-1 border rounded hover:bg-gray-50">
          Appels de fonds
        </a>
      </div>

      <div className="border rounded-lg p-3 bg-white shadow-sm text-xs text-gray-600 space-y-1">
        <div className="font-semibold text-gray-800">Parcours conseillé</div>
        <div>1) Créer l’opération  2) Ajouter les associés + souscriptions  3) Appeler les fonds</div>
        <div>4) Encaisser (banque/caisse)  5) Régulariser (1012 → 1013)</div>
      </div>

      {op && (
        <div className="grid md:grid-cols-4 gap-3">
          <div className="bg-white border rounded p-3 shadow-sm">
            <div className="text-xs text-gray-500">Capital cible</div>
            <div className="text-lg font-semibold">{target.toLocaleString()}</div>
          </div>
          <div className="bg-white border rounded p-3 shadow-sm">
            <div className="text-xs text-gray-500">Total appelé</div>
            <div className="text-lg font-semibold">{totalCalled.toLocaleString()}</div>
            <div className="text-[11px] text-gray-500">Reste à appeler : {remainingToCall.toLocaleString()}</div>
          </div>
          <div className="bg-white border rounded p-3 shadow-sm">
            <div className="text-xs text-gray-500">Total encaissé</div>
            <div className="text-lg font-semibold text-emerald-700">{totalPaid.toLocaleString()}</div>
            <div className="text-[11px] text-gray-500">Reste à encaisser : {remainingToPay.toLocaleString()}</div>
          </div>
          <div className="bg-white border rounded p-3 shadow-sm">
            <div className="text-xs text-gray-500">Régularisation finale</div>
            <div className="text-[12px] text-gray-600">
              Dr 1012 / Cr 1013 sur {Math.min(totalCalled, totalPaid).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}
      {info && <div className="text-sm text-emerald-700">{info}</div>}

      {loading && <div className="text-sm text-gray-500">Chargement...</div>}

      {op && (
        <>
          <Section title="Détails" id="details">
            <div className="grid md:grid-cols-3 text-sm gap-2">
              <div>Réf : {op.ref}</div>
              <div>Type : {op.type}</div>
              <div>Forme : {op.form}</div>
              <div>Capital nominal cible : {Number(op.nominalTarget || 0).toLocaleString()}</div>
              <div>Prime cible : {op.premiumTarget ? Number(op.premiumTarget).toLocaleString() : "-"}</div>
              <div>Décision : {op.decisionRef || "-"}</div>
            </div>
            <div className="text-xs text-gray-600 flex items-center gap-2">
              <form
                className="flex items-center gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const res = await fetch(`/api/capital-operations/${opId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "REGISTERED", regularize: true }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setError(data.error || "Erreur régularisation");
                  } else {
                    await load();
                  }
                }}
              >
                <button
                  type="submit"
                  className="px-2 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700"
                  disabled={op.status === "REGISTERED"}
                >
                  Régulariser & marquer REGISTERED
                </button>
              </form>
              <span className="text-gray-500">
                Effectue Dr 1012 / Cr 1013 sur les montants appelés & encaissés.
              </span>
            </div>
          </Section>

          <Section title="Souscriptions" id="subscriptions">
            <div className="grid md:grid-cols-2 gap-4">
              <form onSubmit={createSubscription} className="flex flex-wrap gap-2 text-sm items-end">
                <div className="text-xs text-gray-500 w-full">
                  Renseignez le montant souscrit. La promesse poste Dr 109 / Cr 1011, puis les appels
                  reclassent vers 4612/1012.
                </div>
                <label className="space-y-1">
                  <span>Associé/Actionnaire</span>
                  <select
                    className="border rounded px-2 py-1 w-64"
                    value={subForm.shareholderId}
                    onChange={(e) => setSubForm((f) => ({ ...f, shareholderId: e.target.value }))}
                    required
                  >
                    <option value="">-- Choisir --</option>
                    {shareholders.map((sh) => (
                      <option key={sh.id} value={sh.id}>
                        {sh.name} ({sh.type})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span>Nominal</span>
                  <input
                    type="number"
                    className="border rounded px-2 py-1 w-32"
                    value={subForm.nominalAmount}
                    onChange={(e) => setSubForm((f) => ({ ...f, nominalAmount: e.target.value }))}
                    placeholder="100000"
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span>Prime</span>
                  <input
                    type="number"
                    className="border rounded px-2 py-1 w-24"
                    value={subForm.premiumAmount}
                    onChange={(e) => setSubForm((f) => ({ ...f, premiumAmount: e.target.value }))}
                    placeholder="20000"
                  />
                </label>
                <label className="space-y-1">
                  <span>Parts/Actions</span>
                  <input
                    type="number"
                    className="border rounded px-2 py-1 w-24"
                    value={subForm.sharesCount}
                    onChange={(e) => setSubForm((f) => ({ ...f, sharesCount: e.target.value }))}
                    placeholder="100"
                  />
                </label>
                <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Ajouter
                </button>
              </form>

              <form onSubmit={createShareholder} className="flex flex-wrap gap-2 text-sm items-end bg-gray-50 p-2 rounded border">
                <div className="text-xs text-gray-600 w-full">Créer un associé/actionnaire</div>
                <label className="space-y-1">
                  <span>Nom</span>
                  <input
                    className="border rounded px-2 py-1 w-48"
                    value={shForm.name}
                    onChange={(e) => setShForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </label>
                <label className="space-y-1">
                  <span>Type</span>
                  <select
                    className="border rounded px-2 py-1"
                    value={shForm.type}
                    onChange={(e) => setShForm((f) => ({ ...f, type: e.target.value }))}
                  >
                    <option value="INDIVIDUAL">INDIVIDUAL</option>
                    <option value="COMPANY">COMPANY</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span>Email</span>
                  <input
                    className="border rounded px-2 py-1 w-48"
                    value={shForm.email}
                    onChange={(e) => setShForm((f) => ({ ...f, email: e.target.value }))}
                    type="email"
                  />
                </label>
                <button type="submit" className="px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700">
                  Créer & présélectionner
                </button>
              </form>

              <form onSubmit={updateShareholder} className="flex flex-wrap gap-2 text-sm items-end bg-gray-50 p-2 rounded border">
                <div className="text-xs text-gray-600 w-full">Modifier un associé/actionnaire</div>
                <label className="space-y-1">
                  <span>Sélection</span>
                  <select
                    className="border rounded px-2 py-1 w-56"
                    value={editShId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setEditShId(id);
                      const found = shareholders.find((s) => s.id === id);
                      if (found) {
                        setEditShForm({
                          name: found.name || "",
                          type: found.type || "INDIVIDUAL",
                          email: found.email || "",
                          phone: found.phone || "",
                          address: found.address || "",
                        });
                      } else {
                        setEditShForm({ name: "", type: "INDIVIDUAL", email: "", phone: "", address: "" });
                      }
                    }}
                  >
                    <option value="">-- Choisir --</option>
                    {shareholders.map((sh) => (
                      <option key={sh.id} value={sh.id}>
                        {sh.name} ({sh.type})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span>Nom</span>
                  <input
                    className="border rounded px-2 py-1 w-48"
                    value={editShForm.name}
                    onChange={(e) => setEditShForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </label>
                <label className="space-y-1">
                  <span>Type</span>
                  <select
                    className="border rounded px-2 py-1"
                    value={editShForm.type}
                    onChange={(e) => setEditShForm((f) => ({ ...f, type: e.target.value }))}
                  >
                    <option value="INDIVIDUAL">INDIVIDUAL</option>
                    <option value="COMPANY">COMPANY</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span>Email</span>
                  <input
                    className="border rounded px-2 py-1 w-48"
                    value={editShForm.email}
                    onChange={(e) => setEditShForm((f) => ({ ...f, email: e.target.value }))}
                    type="email"
                  />
                </label>
                <label className="space-y-1">
                  <span>Téléphone</span>
                  <input
                    className="border rounded px-2 py-1 w-40"
                    value={editShForm.phone}
                    onChange={(e) => setEditShForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </label>
                <label className="space-y-1">
                  <span>Adresse</span>
                  <input
                    className="border rounded px-2 py-1 w-48"
                    value={editShForm.address}
                    onChange={(e) => setEditShForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </label>
                <div className="flex gap-2">
                  <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={!editShId}>
                    Mettre à jour
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1 bg-red-600 text-white rounded"
                    disabled={!editShId}
                    onClick={async () => {
                      if (!editShId) return;
                      if (!confirm("Supprimer cet associé/actionnaire ?")) return;
                      setError("");
                      try {
                        const res = await fetch(`/api/shareholders/${editShId}`, { method: "DELETE" });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok || data.error) throw new Error(data.error || "Suppression échouée");
                        setEditShId("");
                        setEditShForm({ name: "", type: "INDIVIDUAL", email: "", phone: "", address: "" });
                        await load();
                      } catch (e) {
                        setError(e.message || "Suppression échouée");
                      }
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </form>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm mt-2">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-1 text-left">Actionnaire</th>
                    <th className="px-3 py-1 text-left">Nominal</th>
                    <th className="px-3 py-1 text-left">Prime</th>
                    <th className="px-3 py-1 text-left">Parts</th>
                    <th className="px-3 py-1 text-left">Note</th>
                    <th className="px-3 py-1 text-left">Actions</th>
                    <th className="px-3 py-1 text-left">Promesse</th>
                    <th className="px-3 py-1 text-left"></th>
                  </tr>
                </thead>
                <tbody>
                  {op.subscriptions?.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="px-3 py-1">{s.shareholder?.name || s.shareholderId}</td>
                      <td className="px-3 py-1">
                        {editSubId === s.id ? (
                          <input
                            type="number"
                            className="border rounded px-2 py-1 w-24"
                            value={editSubForm.nominalAmount}
                            onChange={(e) =>
                              setEditSubForm((f) => ({ ...f, nominalAmount: e.target.value }))
                            }
                          />
                        ) : (
                          Number(s.nominalAmount || 0).toLocaleString()
                        )}
                      </td>
                      <td className="px-3 py-1">
                        {editSubId === s.id ? (
                          <input
                            type="number"
                            className="border rounded px-2 py-1 w-20"
                            value={editSubForm.premiumAmount}
                            onChange={(e) =>
                              setEditSubForm((f) => ({ ...f, premiumAmount: e.target.value }))
                            }
                          />
                        ) : s.premiumAmount ? (
                          Number(s.premiumAmount).toLocaleString()
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-1">
                        {editSubId === s.id ? (
                          <input
                            type="number"
                            className="border rounded px-2 py-1 w-16"
                            value={editSubForm.sharesCount}
                            onChange={(e) =>
                              setEditSubForm((f) => ({ ...f, sharesCount: e.target.value }))
                            }
                          />
                        ) : (
                          s.sharesCount || "-"
                        )}
                      </td>
                      <td className="px-3 py-1">
                        {editSubId === s.id ? (
                          <input
                            className="border rounded px-2 py-1 w-32"
                            value={editSubForm.note}
                            onChange={(e) => setEditSubForm((f) => ({ ...f, note: e.target.value }))}
                          />
                        ) : (
                          s.note || "-"
                        )}
                      </td>
                      <td className="px-3 py-1 text-xs">
                        {editSubId === s.id ? (
                          <div className="flex gap-1">
                            <button
                              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                              onClick={() => updateSubscription(s.id)}
                              type="button"
                            >
                              Sauver
                            </button>
                            <button
                              className="px-2 py-1 border rounded hover:bg-gray-50"
                              type="button"
                              onClick={() => {
                                setEditSubId("");
                                setEditSubForm({ nominalAmount: "", premiumAmount: "", sharesCount: "", note: "" });
                              }}
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            className="px-2 py-1 border rounded hover:bg-gray-50"
                            type="button"
                            onClick={() => {
                              setEditSubId(s.id);
                              setEditSubForm({
                                nominalAmount: s.nominalAmount || "",
                                premiumAmount: s.premiumAmount || "",
                                sharesCount: s.sharesCount || "",
                                note: s.note || "",
                              });
                            }}
                          >
                            Éditer
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-1 text-xs">
                        <button
                          className="px-2 py-1 border rounded hover:bg-gray-100"
                          type="button"
                          onClick={async () => {
                            setError("");
                            setInfo("");
                            try {
                              const res = await fetch(`/api/capital-subscriptions/${s.id}`, { method: "POST" });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok || data.error) throw new Error(data.error || "Post promesse échoué");
                              setInfo("Promesse postée");
                              await load();
                            } catch (e) {
                              setError(e.message || "Post promesse échoué");
                            }
                          }}
                        >
                          Post promesse
                        </button>
                      </td>
                      <td className="px-3 py-1 text-xs">
                        <button
                          className="px-2 py-1 border rounded text-red-700 hover:bg-red-50"
                          type="button"
                          onClick={async () => {
                            if (!confirm("Supprimer cette souscription ? (aucun appel lié)")) return;
                            setError("");
                            try {
                              const res = await fetch(`/api/capital-subscriptions/${s.id}`, { method: "DELETE" });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok || data.error) throw new Error(data.error || "Suppression échouée");
                              await load();
                            } catch (e) {
                              setError(e.message || "Suppression échouée");
                            }
                          }}
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!op.subscriptions?.length && (
                    <tr>
                      <td colSpan={8} className="px-3 py-2 text-center text-gray-500">
                        Aucune souscription.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Appels de fonds" id="calls">
            <form onSubmit={createCall} className="flex flex-wrap gap-2 text-sm items-end">
              <div className="text-xs text-gray-500 w-full">
                Créez un appel de fonds (tout ou partie). Il reclasse 109/1011 vers 4612/1012.
              </div>
              <label className="space-y-1">
                <span>Montant appelé</span>
                <input
                  type="number"
                  className="border rounded px-2 py-1 w-32"
                  value={callForm.amountCalled}
                  onChange={(e) => setCallForm((f) => ({ ...f, amountCalled: e.target.value }))}
                  placeholder="20000"
                  required
                />
              </label>
              <label className="space-y-1">
                <span>Échéance</span>
                <input
                  type="date"
                  className="border rounded px-2 py-1"
                  value={callForm.dueDate}
                  onChange={(e) => setCallForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </label>
              <label className="space-y-1">
                <span>Libellé</span>
                <input
                  className="border rounded px-2 py-1 w-48"
                  value={callForm.label}
                  onChange={(e) => setCallForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Appel #"
                />
              </label>
              <label className="space-y-1">
                <span>Souscription (optionnel)</span>
                <select
                  className="border rounded px-2 py-1 w-48"
                  value={callForm.subscriptionId}
                  onChange={(e) => setCallForm((f) => ({ ...f, subscriptionId: e.target.value }))}
                >
                  <option value="">-- Toutes souscriptions --</option>
                  {op.subscriptions?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shareholder?.name || s.shareholderId} ({s.nominalAmount})
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">
                Créer appel
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm mt-2">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-1 text-left">#</th>
                    <th className="px-3 py-1 text-left">Montant</th>
                    <th className="px-3 py-1 text-left">Statut</th>
                    <th className="px-3 py-1 text-left">Échéance</th>
                    <th className="px-3 py-1 text-left">Souscription</th>
                    <th className="px-3 py-1 text-left">Paiements</th>
                    <th className="px-3 py-1 text-left">Encaisser</th>
                    <th className="px-3 py-1 text-left">Éditer</th>
                    <th className="px-3 py-1 text-left">Supprimer</th>
                  </tr>
                </thead>
                <tbody>
                  {op.calls?.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-3 py-1">Appel {c.callNumber}</td>
                      <td className="px-3 py-1">
                        {editCallId === c.id ? (
                          <input
                            type="number"
                            className="border rounded px-2 py-1 w-28"
                            value={editCallForm.amountCalled}
                            onChange={(e) =>
                              setEditCallForm((f) => ({ ...f, amountCalled: e.target.value }))
                            }
                          />
                        ) : (
                          Number(c.amountCalled || 0).toLocaleString()
                        )}
                      </td>
                      <td className="px-3 py-1">{c.status}</td>
                      <td className="px-3 py-1">
                        {editCallId === c.id ? (
                          <input
                            type="date"
                            className="border rounded px-2 py-1"
                            value={editCallForm.dueDate}
                            onChange={(e) => setEditCallForm((f) => ({ ...f, dueDate: e.target.value }))}
                          />
                        ) : c.dueDate ? (
                          new Date(c.dueDate).toISOString().slice(0, 10)
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-1">
                        {editCallId === c.id ? (
                          <select
                            className="border rounded px-2 py-1 w-48"
                            value={editCallForm.subscriptionId}
                            onChange={(e) => setEditCallForm((f) => ({ ...f, subscriptionId: e.target.value }))}
                          >
                            <option value="">-- Toutes souscriptions --</option>
                            {op.subscriptions?.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.shareholder?.name || s.shareholderId} ({s.nominalAmount})
                              </option>
                            ))}
                          </select>
                        ) : (
                          c.subscription?.shareholder?.name || c.subscriptionId || "-"
                        )}
                      </td>
                      <td className="px-3 py-1 text-xs space-y-1">
                        {(c.payments || []).map((p) => (
                          <div key={p.id}>
                            {Number(p.amount || 0).toLocaleString()} le{" "}
                            {new Date(p.paymentDate).toISOString().slice(0, 10)} ({p.method})
                            {p.journalEntry?.number ? (
                              <div className="text-[11px] text-gray-500">
                                JRN: {p.journalEntry.number}
                              </div>
                            ) : null}
                          </div>
                        ))}
                        {!c.payments?.length && <div className="text-gray-500">Aucun paiement</div>}
                      </td>
                      <td className="px-3 py-1">
                        <form
                          className="flex flex-col gap-1 text-xs"
                          onSubmit={(e) => {
                            setSelectedCall(c.id);
                            setTimeout(() => payCall(e), 0);
                            e.preventDefault();
                            return false;
                          }}
                        >
                          <div className="text-[11px] text-gray-500">
                            Choisir un compte 52 (banque) ou 57 (caisse).
                          </div>
                          <input
                            type="number"
                            className="border rounded px-2 py-1"
                            placeholder="Montant"
                            value={selectedCall === c.id ? payForm.amount : ""}
                            onChange={(e) => {
                              setSelectedCall(c.id);
                              setPayForm((f) => ({ ...f, amount: e.target.value }));
                            }}
                            required
                          />
                          <input
                            type="date"
                            className="border rounded px-2 py-1"
                          value={selectedCall === c.id ? payForm.paymentDate : ""}
                          onChange={(e) => {
                            setSelectedCall(c.id);
                            setPayForm((f) => ({ ...f, paymentDate: e.target.value }));
                          }}
                        />
                        <select
                          className="border rounded px-2 py-1"
                          value={selectedCall === c.id ? payForm.method : "BANK"}
                          onChange={(e) => {
                            setSelectedCall(c.id);
                            setPayForm((f) => ({ ...f, method: e.target.value }));
                          }}
                        >
                          <option value="BANK">BANK</option>
                          <option value="CASH">CASH</option>
                        </select>
                        <select
                          className="border rounded px-2 py-1"
                          value={selectedCall === c.id ? payForm.accountId || "" : ""}
                          onChange={(e) => {
                            setSelectedCall(c.id);
                            setPayForm((f) => ({ ...f, accountId: e.target.value }));
                          }}
                          required
                        >
                          <option value="">Compte (52/57)</option>
                          {accounts
                            .filter((a) =>
                              (payForm.method || "BANK") === "BANK"
                                ? a.number?.startsWith("52")
                                : a.number?.startsWith("57")
                            )
                            .map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.number} · {a.label || a.name || ""}
                              </option>
                            ))}
                        </select>
                        <button type="submit" className="px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700">
                          Payer
                        </button>
                      </form>
                    </td>
                      <td className="px-3 py-1 text-xs">
                        {editCallId === c.id ? (
                          <div className="flex gap-1">
                            <button
                              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                              type="button"
                              onClick={() => updateCall(c.id)}
                            >
                              Sauver
                            </button>
                            <button
                              className="px-2 py-1 border rounded hover:bg-gray-50"
                              type="button"
                              onClick={() => {
                                setEditCallId("");
                                setEditCallForm({ amountCalled: "", dueDate: "", label: "", subscriptionId: "" });
                              }}
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            className="px-2 py-1 border rounded hover:bg-gray-50"
                            type="button"
                            onClick={() => {
                              setEditCallId(c.id);
                              setEditCallForm({
                                amountCalled: c.amountCalled || "",
                                dueDate: c.dueDate ? new Date(c.dueDate).toISOString().slice(0, 10) : "",
                                label: c.label || "",
                                subscriptionId: c.subscriptionId || "",
                              });
                            }}
                          >
                            Éditer
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-1 text-xs">
                        <button
                          className="px-2 py-1 border rounded text-red-700 hover:bg-red-50 disabled:opacity-50"
                          type="button"
                          disabled={!!(c.payments && c.payments.length)}
                          onClick={async () => {
                            if (c.payments?.length) return;
                            if (!confirm("Supprimer cet appel ? (aucun paiement lié)")) return;
                            setError("");
                            try {
                              const res = await fetch(`/api/capital-calls/${c.id}`, { method: "DELETE" });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok || data.error) throw new Error(data.error || "Suppression échouée");
                              await load();
                            } catch (e) {
                              setError(e.message || "Suppression échouée");
                            }
                          }}
                        >
                          {c.payments?.length ? "Paiements liés" : "Supprimer"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!op.calls?.length && (
                    <tr>
                      <td colSpan={9} className="px-3 py-2 text-center text-gray-500">
                        Aucun appel de fonds.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
