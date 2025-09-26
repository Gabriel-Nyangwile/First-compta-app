// src/components/AccountNumberAutocomplete.jsx
'use client';
import { useState, useEffect } from 'react';

export default function AccountAutocomplete({ value, onChange, maxLength = 20, filterPrefix }) {
  // value doit être un objet {id, number, label} ou null
  const safeValue = value && typeof value === 'object' ? value : null;
  const [input, setInput] = useState(safeValue?.number || '');
  const [selected, setSelected] = useState(safeValue || null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (input.length < 1) {
      setSuggestions([]);
      setShowCreate(false);
      return;
    }
    setLoading(true);
    fetch(`/api/account/search?query=${encodeURIComponent(input)}`)
      .then(res => res.json())
      .then(data => {
        let list = data;
        if (filterPrefix) {
          list = list.filter(a => a.number && a.number.startsWith(filterPrefix));
        }
        setSuggestions(list);
        setShowCreate(list.length === 0);
      })
      .finally(() => setLoading(false));
  }, [input]);


  function handleInput(e) {
    const raw = e.target.value;
    const val = (raw == null ? '' : raw).slice(0, maxLength);
    if (selected) setSelected(null);
    setInput(val);
    setError('');
    setShowCreate(false);
    setNewLabel('');
    if (onChange) onChange(null);
  }

  function handleSelect(number) {
    const acc = suggestions.find(a => a.number === number);
    if (acc) {
      setInput(acc.number);
      setSelected(acc);
      setSuggestions([]);
      setShowCreate(false);
      setNewLabel('');
      setError('');
      onChange && onChange(acc);
    }
  }

  async function handleCreateAccount(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/account/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: input, label: newLabel })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la création du compte.');
        setCreating(false);
        return;
      }
      setInput(data.number);
      setSelected(data);
      setSuggestions([]);
      setShowCreate(false);
      setNewLabel('');
      setError('');
      onChange && onChange(data);
    } catch (err) {
      setError('Erreur réseau ou serveur.');
    } finally {
      setCreating(false);
    }
  }

  // Resynchronise quand la prop externe change (ex: sélection forcée, création)
  useEffect(() => {
    if (safeValue && (!selected || safeValue.id !== selected.id)) {
      setSelected(safeValue);
      setInput(safeValue.number || '');
    } else if (!safeValue && selected) {
      setSelected(null);
      setInput('');
    }
  }, [safeValue]);

  return (
    <div className="relative">
      <input
        type="text"
        name="accountNumber"
        id="accountNumber"
        value={input == null ? '' : input}
        onChange={handleInput}
        maxLength={maxLength}
        autoComplete="off"
        className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
        placeholder="Numéro de compte"
      />
      {loading && <div className="absolute left-0 top-full bg-white border px-2 py-1 text-xs">Recherche...</div>}
      {suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 bg-white border border-gray-200 z-10 max-h-40 overflow-auto mt-1 rounded shadow">
          {suggestions.map(acc => (
            <li
              key={acc.id}
              className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
              onClick={() => handleSelect(acc.number)}
            >
              <span className="font-mono text-blue-700">{acc.number}</span> <span className="text-gray-600">{acc.label}</span>
            </li>
          ))}
        </ul>
      )}
      {showCreate && !loading && (
        <div className="mt-2 bg-orange-50 border border-orange-200 rounded p-2">
          <div className="mb-2 text-sm text-orange-700">Aucun compte trouvé. Créer le compte <span className="font-mono font-bold">{input}</span> :</div>
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            required
            maxLength={50}
            className="block w-full px-2 py-1 border border-gray-300 rounded mb-2"
            placeholder="Libellé du compte"
          />
          <button
            type="button"
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            disabled={creating}
            onClick={handleCreateAccount}
          >
            {creating ? 'Création...' : 'Créer et associer'}
          </button>
          {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
        </div>
      )}
    </div>
  );
}
