import { useState, useEffect } from "react";
import Link from "next/link";

export default function ClientAutocomplete({ value, onChange }) {
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        setClients(data.clients || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = query
    ? clients.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase())
      )
    : clients;

  function handleSelect(client) {
    onChange(client);
    setQuery(client.name);
    setShowDropdown(false);
  }

  function handleInput(e) {
    setQuery(e.target.value);
    setShowDropdown(true);
    if (value && value.name !== e.target.value) {
      onChange(null);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => setShowDropdown(true)}
        placeholder="Rechercher ou créer..."
        className="block w-full border rounded px-2 py-1"
      />
      {showDropdown && (
        <div className="absolute left-0 right-0 bg-white border rounded shadow z-10 max-h-48 overflow-auto">
          {loading ? (
            <div className="p-2 text-gray-500">Chargement...</div>
          ) : filtered.length > 0 ? (
            filtered.map((client) => (
              <button
                key={client.id}
                type="button"
                className="block w-full text-left px-4 py-2 hover:bg-blue-50"
                onClick={() => handleSelect(client)}
              >
                {client.name}
              </button>
            ))
          ) : (
            <div className="p-2 text-gray-500">Aucun client trouvé.</div>
          )}
          <div className="border-t mt-1">
            <Link
              href="/clients/create"
              className="block px-4 py-2 text-blue-600 hover:bg-blue-50"
            >
              + Créer un nouveau client
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
