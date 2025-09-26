// src/components/ClientNameAutocomplete.jsx
'use client';
import { useState, useEffect } from 'react';

export default function ClientNameAutocomplete({ value, onChange, maxLength = 20 }) {
  // value doit être un objet {id, name} ou null
  const safeValue = value && typeof value === 'object' ? value : null;
  const [input, setInput] = useState(safeValue?.name || '');
  const [selected, setSelected] = useState(safeValue || null);

  // Synchronise l'input avec la prop value
  useEffect(() => {
    if (safeValue && safeValue.name !== input) {
      setInput(safeValue.name || '');
      setSelected(safeValue);
    } else if (!safeValue && selected) {
      setInput('');
      setSelected(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeValue]);
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
    fetch(`/api/clients/search?query=${encodeURIComponent(input)}`)
      .then(res => res.json())
      .then(data => {
        setSuggestions(data);
        setShowCreate(data.length === 0);
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

  function handleSelect(name) {
    const cli = suggestions.find(a => a.name === name);
    if (cli) {
      setInput(cli.name);
      setSelected(cli);
      setSuggestions([]);
      setShowCreate(false);
      setNewLabel('');
      setError('');
      onChange && onChange(cli);
    }
  }

  // La création de client est désormais gérée par la modale du formulaire de facture.
  // Cette fonction est conservée (placeholder) si on souhaite réintroduire la création inline.
  async function handleCreateClient(e) {
    e.preventDefault();
    setError('Création inline désactivée. Utiliser le formulaire principal.');
  }

  return (
    <div className="relative">
      <input
        type="text"
        name="clientName"
        id="clientName"
        value={input == null ? '' : input}
        onChange={handleInput}
        maxLength={maxLength}
        autoComplete="off"
        className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
        placeholder="Nom du client"
        disabled={!!selected}
      />
      {selected && (
        <button
          type="button"
          className="absolute right-2 top-2 text-gray-400 hover:text-red-500 text-lg"
          onClick={() => {
            setInput('');
            setSelected(null);
            setSuggestions([]);
            setShowCreate(false);
            setNewLabel('');
            setError('');
            onChange && onChange(null);
          }}
          aria-label="Effacer la sélection"
        >
          ×
        </button>
      )}
      {loading && <div className="absolute left-0 top-full bg-white border px-2 py-1 text-xs">Recherche...</div>}
      {suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 bg-white border border-gray-200 z-10 max-h-40 overflow-auto mt-1 rounded shadow">
          {suggestions.map(cli => (
            <li
              key={cli.id}
              className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
              onClick={() => handleSelect(cli.name)}
            >
              <span className="font-mono text-blue-700">{cli.name}</span>
            </li>
          ))}
        </ul>
      )}
      {showCreate && !loading && (
        <div className="mt-2 bg-orange-50 border border-orange-200 rounded p-2">
          <div className="mb-2 text-sm text-orange-700">Aucun client trouvé. Créer le client <span className="font-mono font-bold">{input}</span> :</div>
          <input
            type="text"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            required
            maxLength={50}
            className="block w-full px-2 py-1 border border-gray-300 rounded mb-2"
            placeholder="Libellé du client"
          />
          <button
            type="button"
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            disabled={creating}
            onClick={handleCreateClient}
          >
            {creating ? 'Création...' : 'Créer et associer'}
          </button>
          {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
        </div>
      )}
    </div>
  );
}
