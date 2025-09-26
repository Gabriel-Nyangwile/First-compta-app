// src/components/ClientList.jsx

export default function ClientList({ clients }) {
  if (!clients.length) {
    return <p className="text-gray-500 italic">Aucun client trouvé.</p>;
  }
  return (
    <ul className="space-y-3">
      {clients.map((client) => (
        <li
          key={client.id}
          className="p-4 bg-white rounded-md shadow-sm border border-gray-100 flex justify-between items-center"
        >
          <div>
            <p className="text-sm font-medium text-gray-900">{client.name}</p>
            <p className="text-xs text-gray-600">{client.email}</p>
          </div>
          <div className="flex gap-2">
            <a href={`/clients/edit/${client.id}`} className="text-blue-600 hover:underline text-sm">Éditer</a>
            <a href={`/clients/${client.id}/ledger`} className="text-indigo-600 hover:underline text-sm">Grand Livre</a>
            <button
              className="text-red-600 hover:underline text-sm"
              onClick={() => {
                if (window.confirm('Confirmer la suppression ?')) {
                  fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
                    .then(() => window.location.reload());
                }
              }}
            >Supprimer</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
