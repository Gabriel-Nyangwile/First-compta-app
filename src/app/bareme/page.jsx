"use client";
import { useState, useEffect } from 'react';
import BackButton from '@/components/BackButton';

function fetchAPI(path, options) {
  return fetch(path, options).then(r => r.json());
}

export default function BaremePage() {
  const [baremes, setBaremes] = useState([]);
  const [form, setForm] = useState({ category: '', categoryDescription: '', tension: '', legalSalary: '' });
  const [selectedId, setSelectedId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [notice, setNotice] = useState({ text: '', error: false });

  useEffect(() => {
    fetchAPI('/api/bareme').then(data => setBaremes(data.baremes || []));
  }, [notice.text]);

  // Auto-dismiss banner after a short delay
  useEffect(() => {
    if (!notice.text) return;
    const t = setTimeout(() => setNotice({ text: '', error: false }), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleEditChange(e) {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  }

  async function handleCreate(e) {
    e.preventDefault();
    const payload = {
      ...form,
      legalSalary: form.legalSalary !== '' ? Number(form.legalSalary) : '',
    };
    try {
      const res = await fetchAPI('/api/bareme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res?.error) {
        setNotice({ text: res.error, error: true });
      } else {
        setNotice({ text: 'Barème créé', error: false });
        setForm({ category: '', categoryDescription: '', tension: '', legalSalary: '' });
      }
    } catch (err) {
      setNotice({ text: err?.message || 'Erreur réseau', error: true });
    }
  }

  async function handleDelete(id) {
    try {
      const res = await fetchAPI(`/api/bareme/${id}`, { method: 'DELETE' });
      if (res?.error) setNotice({ text: res.error, error: true });
      else setNotice({ text: 'Barème supprimé', error: false });
    } catch (err) {
      setNotice({ text: err?.message || 'Erreur réseau', error: true });
    }
  }

  function startEdit(b) {
    setSelectedId(b.id);
    setEditForm({
      id: b.id,
      category: b.category || '',
      categoryDescription: b.categoryDescription || '',
      tension: b.tension || '',
      legalSalary: b.legalSalary ?? '',
    });
  }

  async function handleUpdate(e) {
    e.preventDefault();
    const payload = {
      ...editForm,
      legalSalary: editForm.legalSalary !== '' ? Number(editForm.legalSalary) : editForm.legalSalary,
    };
    try {
      const res = await fetchAPI(`/api/bareme/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res?.error) setNotice({ text: res.error, error: true });
      else setNotice({ text: 'Barème modifié', error: false });
      setSelectedId(null);
      setEditForm(null);
    } catch (err) {
      setNotice({ text: err?.message || 'Erreur réseau', error: true });
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-2">
        <BackButton>← Retour</BackButton>
      </div>
      <h1 className="text-2xl font-bold mb-4">Barèmes salariaux</h1>
      {notice.text && (
        <div className={`mb-2 ${notice.error ? 'text-red-600' : 'text-green-600'}`}>
          {notice.text}
        </div>
      )}
      <form onSubmit={handleCreate} className="mb-6 grid grid-cols-4 gap-4 bg-gray-50 p-4 rounded">
        <input name="category" value={form.category} onChange={handleChange} placeholder="Catégorie" className="border p-2 rounded" required />
        <input name="categoryDescription" value={form.categoryDescription} onChange={handleChange} placeholder="Description catégorie" className="border p-2 rounded" required />
        <input name="tension" value={form.tension} onChange={handleChange} placeholder="Tension (optionnel)" className="border p-2 rounded" />
        <input name="legalSalary" value={form.legalSalary} onChange={handleChange} placeholder="Salaire légal (€)" className="border p-2 rounded" />
        <button type="submit" className="col-span-4 bg-blue-600 text-white py-2 rounded">Créer</button>
      </form>
      <table className="w-full border mb-8">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Catégorie</th>
            <th className="p-2">Description</th>
            <th className="p-2">Tension</th>
            <th className="p-2">Salaire légal (€)</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {baremes.map(b => (
            <tr key={b.id} className="border-b">
              <td className="p-2">{b.category}</td>
              <td className="p-2">{b.categoryDescription || ''}</td>
              <td className="p-2">{b.tension || ''}</td>
              <td className="p-2">{b.legalSalary}</td>
              <td className="p-2">
                <button className="mr-2 text-blue-600" onClick={() => startEdit(b)}>Modifier</button>
                <button className="text-red-600" onClick={() => handleDelete(b.id)}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {selectedId && editForm && (
        <form onSubmit={handleUpdate} className="mb-6 grid grid-cols-4 gap-4 bg-yellow-50 p-4 rounded">
          <input name="category" value={editForm.category} onChange={handleEditChange} placeholder="Catégorie" className="border p-2 rounded" required />
          <input name="categoryDescription" value={editForm.categoryDescription || ''} onChange={handleEditChange} placeholder="Description catégorie" className="border p-2 rounded" required />
          <input name="tension" value={editForm.tension || ''} onChange={handleEditChange} placeholder="Tension (optionnel)" className="border p-2 rounded" />
          <input name="legalSalary" value={editForm.legalSalary} onChange={handleEditChange} placeholder="Salaire légal (€)" className="border p-2 rounded" />
          <button type="submit" className="col-span-4 bg-yellow-600 text-white py-2 rounded">Enregistrer</button>
        </form>
      )}
    </div>
  );
}
