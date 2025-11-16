"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function StockAlertsPage() {
  const [filter, setFilter] = useState('all'); // all, alert, noalert
  // Export CSV
  const handleExportCSV = () => {
    if (!alerts.length) return;
    const header = ['SKU','Nom','Stock actuel','Seuil alerte','Coût moyen','Alerte'];
    const rows = alerts.map(a => [
      a.sku,
      a.name,
      a.qtyOnHand,
      a.minStockAlert,
      a.avgCost,
      a.alert ? 'ALERTE' : ''
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-alerts-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  // Export PDF (simple, via window.print)
  const handleExportPDF = () => {
    if (!alerts.length) return;
    const html = `
      <html>
      <head>
        <title>Stock en alerte</title>
        <style>
          body { font-family: sans-serif; padding: 2em; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #888; padding: 6px 12px; }
          th { background: #eee; }
        </style>
      </head>
      <body>
        <h1>Stock en alerte au ${new Date().toLocaleDateString()}</h1>
        <table>
          <thead>
            <tr><th>SKU</th><th>Nom</th><th>Stock actuel</th><th>Seuil alerte</th><th>Coût moyen</th><th>Alerte</th></tr>
          </thead>
          <tbody>
            ${alerts.map(a => `<tr><td>${a.sku}</td><td>${a.name}</td><td>${a.qtyOnHand}</td><td>${a.minStockAlert}</td><td>${a.avgCost}</td><td>${a.alert ? 'ALERTE' : ''}</td></tr>`).join('')}
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
  };
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [productId, setProductId] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const fetchAlerts = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const url = id ? `/api/stock-alerts?productId=${id}` : "/api/stock-alerts";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Erreur chargement alertes");
      const payload = await res.json();
      setAlerts(Array.isArray(payload) ? payload : [payload]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts(productId);
  }, [productId]);

  return (
  <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Stock en Alerte</h1>
      <div className="mb-4 flex flex-col gap-2 max-w-md relative">
        <div className="flex gap-2 items-center mb-2">
          <label className="text-sm">Filtrer&nbsp;:</label>
          <select
            className="border px-2 py-1 rounded text-sm"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          >
            <option value="all">Tous</option>
            <option value="alert">En alerte</option>
            <option value="noalert">Hors alerte</option>
          </select>
        </div>
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
          onClick={() => fetchAlerts(productId)}
          disabled={loading}
        >
          Rechercher
        </button>
        <div className="flex gap-2 mt-2">
          <button
            className="bg-green-600 text-white px-3 py-1 rounded"
            onClick={handleExportCSV}
            disabled={!alerts.length}
          >
            Export CSV
          </button>
          <button
            className="bg-gray-700 text-white px-3 py-1 rounded"
            onClick={handleExportPDF}
            disabled={!alerts.length}
          >
            Export PDF
          </button>
        </div>
      </div>
      {loading && <div>Chargement...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {alerts.length > 0 ? (
        <table className="min-w-full border text-xs mt-4">
          <thead className="bg-gray-100">
            <tr>
              <th>SKU</th>
              <th>Nom</th>
              <th>Stock actuel</th>
              <th>Seuil d'alerte</th>
              <th>Coût moyen</th>
              <th>Alerte</th>
            </tr>
          </thead>
          <tbody>
            {alerts
              .filter(a =>
                filter === 'all' ? true :
                filter === 'alert' ? a.alert :
                filter === 'noalert' ? !a.alert : true
              )
              .map(alert => (
                <tr key={alert.id} className={`border-b ${alert.alert ? "bg-red-50" : ""}`}>
                  <td>{alert.sku}</td>
                  <td>{alert.name}</td>
                  <td>{alert.qtyOnHand}</td>
                  <td>{alert.minStockAlert}</td>
                  <td>{alert.avgCost}</td>
                  <td>{alert.alert ? <span className="text-red-600 font-bold">⚠️</span> : ""}</td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : (
        <div className="text-gray-500 mt-4">Aucun produit trouvé.</div>
      )}
    </div>
  );
}
