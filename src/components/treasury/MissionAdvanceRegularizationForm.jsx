"use client";

import { useEffect, useMemo, useState } from "react";
import AccountAutocomplete from "../AccountAutocomplete.jsx";
import Amount from "@/components/Amount.jsx";

export default function MissionAdvanceRegularizationForm() {
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeResults, setEmployeeResults] = useState([]);
  const [searchingEmployees, setSearchingEmployees] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [advances, setAdvances] = useState([]);
  const [loadingAdvances, setLoadingAdvances] = useState(false);
  const [advanceMovementId, setAdvanceMovementId] = useState("");
  const [expenseAccount, setExpenseAccount] = useState(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("Régularisation du dossier d'avance de mission");
  const [supportRef, setSupportRef] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const selectedAdvance = useMemo(
    () => advances.find((advance) => advance.id === advanceMovementId) || null,
    [advances, advanceMovementId]
  );

  useEffect(() => {
    if (!employeeQuery) {
      setEmployeeResults([]);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        setSearchingEmployees(true);
        const res = await fetch(`/api/employee?q=${encodeURIComponent(employeeQuery)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur de chargement des employés");
        if (!active) return;
        setEmployeeResults(
          (data.employees || []).slice(0, 20).map((employee) => ({
            id: employee.id,
            label: `${employee.employeeNumber || "—"} ${employee.firstName || ""} ${employee.lastName || ""}`.trim(),
          }))
        );
      } catch {
        if (active) setEmployeeResults([]);
      } finally {
        if (active) setSearchingEmployees(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [employeeQuery]);

  useEffect(() => {
    if (!selectedEmployee?.id) {
      setAdvances([]);
      setAdvanceMovementId("");
      return;
    }
    let active = true;
    async function loadAdvances() {
      try {
        setLoadingAdvances(true);
        const res = await fetch(
          `/api/treasury/mission-advances/open?employeeId=${encodeURIComponent(selectedEmployee.id)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur de chargement des dossiers d'avance");
        if (!active) return;
        setAdvances(data.advances || []);
        setAdvanceMovementId((data.advances || [])[0]?.id || "");
      } catch {
        if (active) {
          setAdvances([]);
          setAdvanceMovementId("");
        }
      } finally {
        if (active) setLoadingAdvances(false);
      }
    }
    loadAdvances();
    return () => {
      active = false;
    };
  }, [selectedEmployee]);

  useEffect(() => {
    if (selectedAdvance && !amount) {
      setAmount(Number(selectedAdvance.remainingAmount || 0).toFixed(2));
    }
  }, [selectedAdvance, amount]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setOkMsg("");
    if (!selectedEmployee) {
      setError("Employé requis");
      return;
    }
    if (!advanceMovementId) {
      setError("Avance de mission requise");
      return;
    }
    if (!expenseAccount?.id) {
      setError("Compte de charge requis");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("Montant invalide");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/treasury/mission-advance-regularizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advanceMovementId,
          expenseAccountId: expenseAccount.id,
          amount: Number(amount),
          date: date || null,
          supportRef: supportRef || null,
          description: description || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Erreur lors de l’enregistrement de la régularisation");
      setOkMsg("Régularisation enregistrée sur le dossier d'avance");
      setAmount("");
      setSupportRef("");
      window.location.href = "/treasury";
    } catch (err) {
      setError(err.message || "Erreur lors de la régularisation du dossier d'avance");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white border rounded p-6 max-w-5xl">
      <h3 className="font-semibold text-sm">Régulariser un dossier d'avance de mission</h3>
      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <label className="flex flex-col">
          Rechercher employé
          <input
            value={employeeQuery}
            onChange={(e) => setEmployeeQuery(e.target.value)}
            type="text"
            placeholder="Matricule, nom..."
            className="mt-1 border rounded px-2 py-1"
          />
        </label>
        <label className="flex flex-col">
          Dossier d'avance ouvert
          <select
            value={advanceMovementId}
            onChange={(e) => setAdvanceMovementId(e.target.value)}
            className="mt-1 border rounded px-2 py-1"
            disabled={!selectedEmployee || loadingAdvances}
          >
            <option value="">
              {loadingAdvances ? "Chargement..." : "Sélectionner"}
            </option>
            {advances.map((advance) => (
              <option key={advance.id} value={advance.id}>
                {advance.voucherRef} · reliquat {Number(advance.remainingAmount || 0).toFixed(2)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">
          Compte de charge
          <AccountAutocomplete value={expenseAccount} onChange={setExpenseAccount} filterPrefix="6" />
        </label>
      </div>

      {selectedEmployee && (
        <div className="text-xs text-slate-600 border rounded px-3 py-2 bg-slate-50">
          Employé concerné: <strong>{selectedEmployee.label}</strong>
        </div>
      )}

      {!selectedEmployee && (
        <div className="max-h-32 overflow-auto divide-y border rounded bg-white">
          {searchingEmployees && <div className="p-2 text-xs text-slate-500">Recherche des employés...</div>}
          {!searchingEmployees && employeeQuery && employeeResults.length === 0 && (
            <div className="p-2 text-xs text-slate-500">Aucun employé trouvé</div>
          )}
          {employeeResults.map((employee) => (
            <button
              type="button"
              key={employee.id}
              onClick={() => {
                setSelectedEmployee(employee);
                setEmployeeQuery("");
                setEmployeeResults([]);
              }}
              className="w-full text-left px-2 py-1 hover:bg-blue-50 text-xs"
            >
              {employee.label}
            </button>
          ))}
        </div>
      )}

      {selectedAdvance && (
        <div className="grid md:grid-cols-3 gap-3 text-xs text-slate-600 border rounded px-3 py-2 bg-slate-50">
          <div>
            Réf dossier: <strong>{selectedAdvance.voucherRef}</strong>
          </div>
          <div>
            Avance: <strong><Amount value={selectedAdvance.amount} /></strong>
          </div>
          <div>
            Reliquat: <strong><Amount value={selectedAdvance.remainingAmount} /></strong>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-4 gap-3 text-sm">
        <label className="flex flex-col">
          Montant à imputer
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" className="mt-1 border rounded px-2 py-1" />
        </label>
        <label className="flex flex-col">
          Date
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className="mt-1 border rounded px-2 py-1" />
        </label>
        <label className="flex flex-col">
          Pièce / justificatif
          <input value={supportRef} onChange={(e) => setSupportRef(e.target.value)} type="text" className="mt-1 border rounded px-2 py-1" placeholder="NF-..., OM-..." />
        </label>
        <label className="flex flex-col">
          Description
          <input value={description} onChange={(e) => setDescription(e.target.value)} type="text" className="mt-1 border rounded px-2 py-1" />
        </label>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}
      {okMsg && <div className="text-green-600 text-sm">{okMsg}</div>}

      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-500 disabled:opacity-50">
          {loading ? "En cours..." : "Enregistrer la régularisation"}
        </button>
        {selectedEmployee && (
          <button
            type="button"
            onClick={() => {
              setSelectedEmployee(null);
              setAdvances([]);
              setAdvanceMovementId("");
            }}
            className="px-3 py-2 text-sm border rounded hover:bg-slate-50"
          >
            Changer employé
          </button>
        )}
      </div>
    </form>
  );
}
