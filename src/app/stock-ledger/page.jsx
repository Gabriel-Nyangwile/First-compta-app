"use client";
import { useEffect, useState } from "react";
import Link from "next/link";


export default function StockLedgerPage() {
  // Export global PDF (tous les produits)
  const handleExportGlobalPDF = async () => {
    try {
      const res = await fetch('/api/stock-ledger?all=1');
      if (!res.ok) throw new Error('Erreur chargement global');
      const payload = await res.json();
      const products = payload.products || [];
      // Génère une table HTML pour impression
      const html = `
        <html>
        <head>
          <title>Stock global</title>
          <style>
            body { font-family: sans-serif; padding: 2em; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #888; padding: 6px 12px; }
            th { background: #eee; }
          </style>
        </head>
        <body>
          <h1>Stock global au ${new Date().toLocaleDateString()}</h1>
          <table>
            <thead>
              <tr><th>SKU</th><th>Nom</th><th>Stock final</th><th>Coût moyen final</th></tr>
            </thead>
            <tbody>
              ${products.map(prod => `<tr><td>${prod.sku}</td><td>${prod.name}</td><td>${prod.stockFinal}</td><td>${prod.avgCostFinal}</td></tr>`).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } catch (e) {
      alert('Erreur export PDF global: ' + e.message);
    }
  };
  // Export global CSV (tous les produits)
  const handleExportGlobalCSV = async () => {
    try {
      const res = await fetch('/api/stock-ledger?all=1');
      if (!res.ok) throw new Error('Erreur chargement global');
      const payload = await res.json();
      // On attend un tableau [{sku, name, stockFinal, avgCostFinal}]
      const header = ['SKU','Nom','Stock final','Coût moyen final'];
      const rows = (payload.products || []).map(prod => [
        prod.sku,
        prod.name,
        prod.stockFinal,
        prod.avgCostFinal
      ]);
      const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock-global-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (e) {
      alert('Erreur export global: ' + e.message);
    }
  };
  // Export CSV
  const handleExportCSV = () => {
    if (!data) return;
    const header = ['Date','Type','Quantité','Coût unitaire','Référence','Commentaire'];
    const rows = (data.movements || []).map(mvt => [
      new Date(mvt.date).toLocaleDateString(),
      mvt.movementType,
      mvt.qty,
      mvt.unitCost,
      mvt.reference || '',
      mvt.comment || ''
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-stock-${data.product?.sku || 'export'}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  // Export PDF (simple, via window.print)
  const handleExportPDF = () => {
    window.print();
  };
  const [productId, setProductId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [auditError, setAuditError] = useState(null);

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancel = false;
    fetch(`/api/products?q=${encodeURIComponent(query)}&active=1`)
      .then(r => r.ok ? r.json() : [])
      .then(list => {
        if (!cancel) setSuggestions(list);
      });
    return () => { cancel = true; };
  }, [query]);

  const fetchLedger = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stock-ledger?productId=${id}`);
      if (!res.ok) throw new Error("Erreur chargement ledger");
      const payload = await res.json();
      setData(payload);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productId) fetchLedger(productId);
  }, [productId]);

  // ...existing code...
  const handleAuditStock = async () => {
    setAuditLoading(true);
    setAuditError(null);
    setAuditResult(null);
    try {
      const res = await fetch("/api/audit-stock");
      if (!res.ok) throw new Error("Erreur audit stock");
      const result = await res.json();
      setAuditResult(result);
    } catch (e) {
      setAuditError(e.message);
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Ledger Stock par Produit</h1>
      <div className="mb-4 flex flex-col gap-2 max-w-md relative">
        <input
          type="text"
          className="border px-2 py-1 rounded"
          placeholder="Nom ou SKU produit..."
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          autoComplete="off"
        />
        {showDropdown && suggestions.length > 0 && (
          <ul className="absolute top-10 left-0 w-full bg-white border rounded shadow z-10 max-h-48 overflow-y-auto">
            {suggestions.map(prod => (
              <li
                key={prod.id}
                className="px-3 py-2 cursor-pointer hover:bg-blue-100 text-sm"
                onClick={() => {
                  setProductId(prod.id);
                  setQuery(`${prod.sku} — ${prod.name}`);
                  setShowDropdown(false);
                }}
              >
                <span className="font-mono text-blue-700">{prod.sku}</span> — {prod.name}
              </li>
            ))}
          </ul>
        )}
        <button
          className="bg-blue-600 text-white px-3 py-1 rounded mt-2"
          onClick={() => productId && fetchLedger(productId)}
          disabled={loading || !productId}
        >
          Charger
        </button>
        <button
          className="bg-yellow-600 text-white px-3 py-1 rounded mt-2"
          onClick={handleAuditStock}
          disabled={auditLoading}
        >
          {auditLoading ? "Audit en cours..." : "Audit stock"}
        </button>
        <div className="flex gap-2 mt-2">
          <button
            className="bg-green-600 text-white px-3 py-1 rounded"
            onClick={handleExportCSV}
            disabled={!data || !data.movements?.length}
          >
            Export CSV
          </button>
          <button
            className="bg-gray-700 text-white px-3 py-1 rounded"
            onClick={handleExportPDF}
            disabled={!data || !data.movements?.length}
          >
            Export PDF
          </button>
          <button
            className="bg-blue-700 text-white px-3 py-1 rounded"
            onClick={handleExportGlobalCSV}
          >
            Export global CSV
          </button>
          <button
            className="bg-gray-900 text-white px-3 py-1 rounded"
            onClick={handleExportGlobalPDF}
          >
            Export global PDF
          </button>
        </div>
      </div>
      {loading && <div>Chargement...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {data && (
        <div className="mb-4">
          <h2 className="font-semibold text-lg mb-2">Produit</h2>
          <div className="mb-2">SKU: {data.product?.sku} | Nom: {data.product?.name}</div>
          <div className="mb-2">Solde début: {data.openingQty} @ {data.openingCost}</div>
          <div className="mb-2">Solde fin: {data.closingQty} @ {data.closingCost}</div>
          <div className="mb-2 font-bold text-blue-700">Stock final: {data.stockFinal} | Coût moyen final: {data.avgCostFinal}</div>
        </div>
      )}
      {data?.movements?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-xs">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="py-2 px-2">Date</th>
                <th className="py-2 px-2" title="Type de mouvement (entrée, sortie, ajustement, etc.)">Type</th>
                <th className="py-2 px-2" title="Quantité mouvementée">Quantité</th>
                <th className="py-2 px-2" title="Coût unitaire valorisé (CUMP ou achat)">Coût unitaire</th>
                <th className="py-2 px-2" title="Référence liée (facture, BC, etc.)">Référence</th>
                <th className="py-2 px-2" title="Commentaire ou note sur le mouvement">Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {data.movements.map((mvt, idx) => (
                <tr key={mvt.id} className={`border-b ${idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'}`}>
                  <td className="px-2 py-1">{new Date(mvt.date).toLocaleDateString()}</td>
                  <td className="px-2 py-1" title={mvt.movementType}>{mvt.movementType}</td>
                  <td className="px-2 py-1" title={`Quantité: ${mvt.qty}`}>{mvt.qty}</td>
                  <td className="px-2 py-1" title={`Coût unitaire: ${mvt.unitCost}`}>{mvt.unitCost}</td>
                  <td className="px-2 py-1" title={mvt.reference || ""}>{mvt.reference || ""}</td>
                  <td className="px-2 py-1" title={mvt.comment || ""}>{mvt.comment || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.movements?.length === 0 && (
        <div className="text-gray-500 mt-4">Aucun mouvement trouvé pour ce produit.</div>
      )}
      {auditError && (
        <div className="text-red-600 mt-4">Erreur audit : {auditError}</div>
      )}
      {auditResult && (
        <div className="mt-4">
          <h2 className="font-semibold text-lg mb-2 text-yellow-700">Résultat audit stock</h2>
          {auditResult.ok ? (
            <div className="text-green-700">Aucune anomalie détectée.</div>
          ) : (
            <ul className="list-disc pl-6 text-red-700">
              {auditResult.issues?.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
