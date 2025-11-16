"use client"
import { useState, useEffect } from 'react';
import BackButton from '@/components/BackButton';

function fetchAPI(path, options) {
  return fetch(path, options).then(r => r.json());
}

export default function PositionPage() {
  const [positions, setPositions] = useState([]);
  const [baremes, setBaremes] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', baremeId: '' });
  const [selectedId, setSelectedId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchAPI('/api/position').then(data => setPositions(data.positions || []));
    fetchAPI('/api/bareme').then(data => setBaremes(data.baremes || []));
  }, [message]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleEditChange(e) {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  }

  async function handleCreate(e) {
    e.preventDefault();
    const res = await fetchAPI('/api/position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setMessage(res.error ? res.error : 'Poste créé');
    setForm({ title: '', description: '', baremeId: '' });
  }

  async function handleDelete(id) {
    await fetchAPI(`/api/position/${id}`, { method: 'DELETE' });
    setMessage('Poste supprimé');
  }

  function startEdit(pos) {
    setSelectedId(pos.id);
    setEditForm({ ...pos, baremeId: pos.baremeId || '' });
  }

  async function handleUpdate(e) {
    e.preventDefault();
    const res = await fetchAPI(`/api/position/${selectedId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setMessage(res?.error ? `Erreur: ${res.error}` : 'Poste modifié');
    setSelectedId(null);
    setEditForm(null);
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-2">
        <BackButton>← Retour</BackButton>
      </div>
      <h1 className="text-2xl font-bold mb-4">Postes</h1>
      {message && <div className="mb-2 text-green-600">{message}</div>}
      <form onSubmit={handleCreate} className="mb-6 grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded">
        <input name="title" value={form.title} onChange={handleChange} placeholder="Titre" className="border p-2 rounded" required />
        <input name="description" value={form.description} onChange={handleChange} placeholder="Description" className="border p-2 rounded" />
        <select name="baremeId" value={form.baremeId} onChange={handleChange} className="border p-2 rounded">
          <option value="">Barème (optionnel)</option>
          {baremes.map(b => (
            <option key={b.id} value={b.id}>{b.category}{b.categoryDescription ? ` - ${b.categoryDescription}` : ''}{b.tension ? ` · ${b.tension}` : ''} ({b.legalSalary}€)</option>
          ))}
        </select>
        <button type="submit" className="col-span-2 bg-blue-600 text-white py-2 rounded">Créer</button>
      </form>
      <table className="w-full border mb-8">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Titre</th>
            <th className="p-2">Description</th>
            <th className="p-2">Barème</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {positions.map(pos => (
            <tr key={pos.id} className="border-b">
              <td className="p-2">{pos.title}</td>
              <td className="p-2">{pos.description}</td>
              <td className="p-2">{pos.bareme ? `${pos.bareme.category}${pos.bareme.categoryDescription ? ' - ' + pos.bareme.categoryDescription : ''}${pos.bareme.tension ? ' · ' + pos.bareme.tension : ''} (${pos.bareme.legalSalary}€)` : ''}</td>
              <td className="p-2">
                <button className="mr-2 text-blue-600" onClick={() => startEdit(pos)}>Modifier</button>
                <button className="text-red-600" onClick={() => handleDelete(pos.id)}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {selectedId && editForm && (
        <form onSubmit={handleUpdate} className="mb-6 grid grid-cols-2 gap-4 bg-yellow-50 p-4 rounded">
          <input name="title" value={editForm.title} onChange={handleEditChange} placeholder="Titre" className="border p-2 rounded" required />
          <input name="description" value={editForm.description} onChange={handleEditChange} placeholder="Description" className="border p-2 rounded" />
          <select name="baremeId" value={editForm.baremeId || ''} onChange={handleEditChange} className="border p-2 rounded">
            <option value="">Barème (optionnel)</option>
            {baremes.map(b => (
              <option key={b.id} value={b.id}>{b.category}{b.categoryDescription ? ` - ${b.categoryDescription}` : ''}{b.tension ? ` · ${b.tension}` : ''} ({b.legalSalary}€)</option>
            ))}
          </select>
          <button type="submit" className="col-span-2 bg-yellow-600 text-white py-2 rounded">Enregistrer</button>
        </form>
      )}
    </div>
  );
}
