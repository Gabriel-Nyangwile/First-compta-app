// src/components/SearchFilterControls.jsx
'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce'; // Pour éviter des re-renderings trop fréquents

export default function SearchFilterControls({ initialFilters, clients }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // État local pour chaque filtre
  const [query, setQuery] = useState(initialFilters.query);
  const [status, setStatus] = useState(initialFilters.status);
  const [clientId, setClientId] = useState(initialFilters.clientId);
  const [dateField, setDateField] = useState(initialFilters.dateField);
  const [startDate, setStartDate] = useState(initialFilters.startDate);
  const [endDate, setEndDate] = useState(initialFilters.endDate);

  // Met à jour l'état local si les filtres initiaux changent (ex: navigation arrière/avant)
  useEffect(() => {
    setQuery(initialFilters.query);
    setStatus(initialFilters.status);
    setClientId(initialFilters.clientId);
    setDateField(initialFilters.dateField);
    setStartDate(initialFilters.startDate);
    setEndDate(initialFilters.endDate);
  }, [initialFilters]);

  // Fonction pour mettre à jour l'URL avec les nouveaux paramètres de recherche
  const updateUrl = useDebouncedCallback(() => {
    const params = new URLSearchParams(searchParams);

    if (query) params.set('query', query); else params.delete('query');
    if (status && status !== 'ALL') params.set('status', status); else params.delete('status');
    if (clientId && clientId !== 'ALL') params.set('clientId', clientId); else params.delete('clientId');
    if (dateField && (startDate || endDate)) params.set('dateField', dateField); else params.delete('dateField');
    if (startDate) params.set('startDate', startDate); else params.delete('startDate');
    if (endDate) params.set('endDate', endDate); else params.delete('endDate');

    router.replace(`${pathname}?${params.toString()}`);
  }, 300); // Déclenche la mise à jour après 300ms de pause dans la saisie

  // Réinitialiser les filtres
  const handleReset = () => {
    setQuery('');
    setStatus('ALL');
    setClientId('ALL');
    setDateField('issueDate');
    setStartDate('');
    setEndDate('');
    router.replace(pathname); // Supprime tous les params
  };

  return (
    <div className="mb-8 p-6 bg-white rounded-lg shadow-md border border-gray-200">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Filtrer les factures</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Recherche textuelle */}
        <div>
          <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-1">Recherche (N°, Client)</label>
          <input
            type="text"
            id="query"
            placeholder="N° facture ou client..."
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              updateUrl();
            }}
          />
        </div>

        {/* Filtre par statut */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
          <select
            id="status"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              updateUrl();
            }}
          >
            <option value="ALL">Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="OVERDUE">En retard</option>
            <option value="PAID">Payée</option>
          </select>
        </div>

        {/* Filtre par client */}
        <div>
          <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-1">Client</label>
          <select
            id="clientId"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              updateUrl();
            }}
          >
            <option value="ALL">Tous les clients</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>{client.name}</option>
            ))}
          </select>
        </div>

        {/* Filtre par période de date */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="dateField" className="block text-sm font-medium text-gray-700 mb-1">Champ date</label>
            <select
              id="dateField"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
              value={dateField}
              onChange={(e) => {
                setDateField(e.target.value);
                updateUrl();
              }}
            >
              <option value="issueDate">Date d'émission</option>
              <option value="dueDate">Date d'échéance</option>
            </select>
          </div>
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Du</label>
            <input
              type="date"
              id="startDate"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                updateUrl();
              }}
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">Au</label>
            <input
              type="date"
              id="endDate"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                updateUrl();
              }}
            />
          </div>
        </div>
      </div>
      <button
        onClick={handleReset}
        className="mt-4 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition duration-150 ease-in-out self-end"
      >
        Réinitialiser les filtres
      </button>
    </div>
  );
}