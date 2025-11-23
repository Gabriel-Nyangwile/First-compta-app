
"use client";
import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import BackButton from '@/components/BackButton';
import LocaleSwitcher from '@/components/LocaleSwitcher';

function fetchAPI(path, options) {
  return fetch(path, options).then(r => r.json());
}

export default function EmployeePage() {
  const [employees, setEmployees] = useState([]);
  const [positions, setPositions] = useState([]);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '', birthDate: '', hireDate: '', endDate: '', employeeNumber: '', gender: '', maritalStatus: '', childrenUnder18: '', socialSecurityNumber: '', contractType: '', status: 'ACTIVE', positionId: '', category: '' });
  const [selectedId, setSelectedId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [message, setMessage] = useState('');
  const STATUS = ['ACTIVE','INACTIVE','SUSPENDED','EXITED'];
  const CONTRACT_TYPES = [
    { value: '', label: 'Type de contrat' },
    { value: 'CDI', label: 'CDI' },
    { value: 'CDD', label: 'CDD' },
    { value: 'CI', label: 'CI' },
  ];
  const GENDERS = [
    { value: '', label: 'Genre' },
    { value: 'MALE', label: 'Homme' },
    { value: 'FEMALE', label: 'Femme' },
  ];
  const MARITAL = [
    { value: '', label: 'État civil' },
    { value: 'SINGLE', label: 'Célibataire' },
    { value: 'MARRIED', label: 'Marié' },
  ];

  const { t } = useI18n();

  useEffect(() => {
    fetchAPI('/api/employee').then(data => setEmployees(data.employees || []));
    fetchAPI('/api/position').then(data => setPositions(data.positions || []));
    fetchAPI('/api/employee-history').then(data => setHistory(data.history || []));
  }, [message]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleEditChange(e) {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  }

  function toInputDate(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d)) return '';
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0,10);
  }

  async function handleCreate(e) {
    e.preventDefault();
    const res = await fetchAPI('/api/employee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setMessage(res.error ? res.error : 'Employé créé');
  setForm({ firstName: '', lastName: '', email: '', phone: '', address: '', birthDate: '', hireDate: '', endDate: '', employeeNumber: '', gender: '', maritalStatus: '', childrenUnder18: '', socialSecurityNumber: '', contractType: '', status: 'ACTIVE', positionId: '', category: '' });
  }

  async function handleDelete(id) {
    await fetchAPI(`/api/employee/${id}`, { method: 'DELETE' });
    setMessage('Employé supprimé');
  }

  function startEdit(emp) {
    setSelectedId(emp.id);
    setEditForm({
      id: emp.id,
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      email: emp.email || '',
      phone: emp.phone || '',
      address: emp.address || '',
      positionId: emp.positionId || '',
  contractType: emp.contractType || '',
  category: emp.category || '',
      employeeNumber: emp.employeeNumber || '',
      gender: emp.gender || '',
      maritalStatus: emp.maritalStatus || '',
      childrenUnder18: emp.childrenUnder18 ?? '',
      socialSecurityNumber: emp.socialSecurityNumber || '',
      status: emp.status || 'ACTIVE',
      birthDate: toInputDate(emp.birthDate),
      hireDate: toInputDate(emp.hireDate),
      endDate: toInputDate(emp.endDate),
    });
  }

  async function handleUpdate(e) {
    e.preventDefault();
    const res = await fetchAPI(`/api/employee/${selectedId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setMessage(res?.error ? `Erreur: ${res.error}` : 'Employé modifié');
    setSelectedId(null);
    setEditForm(null);
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <BackButton>← Retour</BackButton>
          <LocaleSwitcher />
        </div>
      </div>
      <h1 className="text-2xl font-bold mb-4">Gestion du Personnel</h1>
      {message && <div className="mb-2 text-green-600">{message}</div>}
  <form onSubmit={handleCreate} className="mb-6 grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded">
  <input name="firstName" value={form.firstName} onChange={handleChange} placeholder="Prénom" title={t('help.firstName')} className="border p-2 rounded" required />
  <input name="lastName" value={form.lastName} onChange={handleChange} placeholder="Nom" title={t('help.lastName')} className="border p-2 rounded" required />
  <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Email" title={t('help.email')} className="border p-2 rounded" />
  <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="Téléphone" title={t('help.phone')} className="border p-2 rounded" />
  <input name="address" value={form.address} onChange={handleChange} placeholder="Adresse" title={t('help.address')} className="border p-2 rounded" />
  <select name="gender" value={form.gender} onChange={handleChange} className="border p-2 rounded" title={t('help.gender')}>
          {GENDERS.map(o => <option key={o.value + o.label} value={o.value}>{o.label}</option>)}
        </select>
  <select name="maritalStatus" value={form.maritalStatus} onChange={handleChange} className="border p-2 rounded" title={t('help.maritalStatus')}>
          {MARITAL.map(o => <option key={o.value + o.label} value={o.value}>{o.label}</option>)}
        </select>
  <input type="number" min="0" name="childrenUnder18" value={form.childrenUnder18} onChange={handleChange} placeholder="Enfants < 18 ans" title={t('help.childrenUnder18')} className="border p-2 rounded" />
  <input name="socialSecurityNumber" value={form.socialSecurityNumber} onChange={handleChange} placeholder="N° Sécurité sociale" title={t('help.socialSecurityNumber')} inputMode="text" pattern="[0-9A-Za-z ]{12,}" spellCheck={false} className="border p-2 rounded" />
  <input type="date" name="birthDate" value={form.birthDate} onChange={handleChange} className="border p-2 rounded" title={t('help.birthDate')} />
  <input type="date" name="hireDate" value={form.hireDate} onChange={handleChange} className="border p-2 rounded" title={t('help.hireDate')} />
  <input type="date" name="endDate" value={form.endDate} onChange={handleChange} className="border p-2 rounded" title={t('help.endDate')} />
  <input name="employeeNumber" value={form.employeeNumber} onChange={handleChange} placeholder="Matricule (auto si vide)" title={t('help.employeeNumber')} className="border p-2 rounded" />
  <select name="contractType" value={form.contractType} onChange={handleChange} className="border p-2 rounded" title={t('help.contractType')}>
          {CONTRACT_TYPES.map(o => <option key={o.value + o.label} value={o.value}>{o.label}</option>)}
        </select>
  <select name="status" value={form.status} onChange={handleChange} className="border p-2 rounded" title={t('help.status')}>
          {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
  <select name="positionId" value={form.positionId} onChange={handleChange} className="border p-2 rounded" title={t('help.positionId')}>
          <option value="">Poste</option>
          {positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        {/* Contrat supprimé */}
  <input name="category" value={form.category} onChange={handleChange} placeholder="Catégorie (auto)" title={t('help.category')} className="border p-2 rounded bg-gray-100" readOnly />
        <button type="submit" className="col-span-2 bg-blue-600 text-white py-2 rounded">Créer</button>
      </form>
      <table className="w-full border mb-8">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Matricule</th>
            <th className="p-2">Prénom</th>
            <th className="p-2">Nom</th>
            <th className="p-2">Genre</th>
            <th className="p-2">État civil</th>
            <th className="p-2">Enfants &lt;18</th>
            <th className="p-2">N° SS</th>
            <th className="p-2">Email</th>
            <th className="p-2">Statut</th>
            <th className="p-2">Type contrat</th>
            <th className="p-2">Catégorie</th>
            <th className="p-2">Poste</th>
            {/* Contrat supprimé */}
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map(emp => (
            <tr key={emp.id} className="border-b">
              <td className="p-2">{emp.employeeNumber || ''}</td>
              <td className="p-2">{emp.firstName}</td>
              <td className="p-2">{emp.lastName}</td>
              <td className="p-2">{emp.gender === 'MALE' ? 'Homme' : emp.gender === 'FEMALE' ? 'Femme' : ''}</td>
              <td className="p-2">{emp.maritalStatus === 'SINGLE' ? 'Célibataire' : emp.maritalStatus === 'MARRIED' ? 'Marié' : ''}</td>
              <td className="p-2">{emp.childrenUnder18 ?? ''}</td>
              <td className="p-2">{emp.socialSecurityNumber || ''}</td>
              <td className="p-2">{emp.email}</td>
              <td className="p-2">{emp.status}</td>
              <td className="p-2">{emp.contractType || ''}</td>
              <td className="p-2">{emp.category || ''}</td>
              <td className="p-2">{emp.position?.title}</td>
              {/* Contrat supprimé */}
              <td className="p-2">
                <button className="mr-2 text-blue-600" onClick={() => startEdit(emp)}>Modifier</button>
                <button className="text-red-600" onClick={() => handleDelete(emp.id)}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {selectedId && editForm && (
        <form onSubmit={handleUpdate} className="mb-6 grid grid-cols-2 gap-4 bg-yellow-50 p-4 rounded">
          <input name="firstName" value={editForm.firstName} onChange={handleEditChange} placeholder="Prénom" title={t('help.firstName')} className="border p-2 rounded" required />
          <input name="lastName" value={editForm.lastName} onChange={handleEditChange} placeholder="Nom" title={t('help.lastName')} className="border p-2 rounded" required />
          <input type="email" name="email" value={editForm.email} onChange={handleEditChange} placeholder="Email" title={t('help.email')} className="border p-2 rounded" />
          <input type="tel" name="phone" value={editForm.phone || ''} onChange={handleEditChange} placeholder="Téléphone" title={t('help.phone')} className="border p-2 rounded" />
          <input name="address" value={editForm.address || ''} onChange={handleEditChange} placeholder="Adresse" title={t('help.address')} className="border p-2 rounded" />
          <select name="gender" value={editForm.gender || ''} onChange={handleEditChange} className="border p-2 rounded" title={t('help.gender')}>
            {GENDERS.map(o => <option key={o.value + o.label} value={o.value}>{o.label}</option>)}
          </select>
          <select name="maritalStatus" value={editForm.maritalStatus || ''} onChange={handleEditChange} className="border p-2 rounded" title={t('help.maritalStatus')}>
            {MARITAL.map(o => <option key={o.value + o.label} value={o.value}>{o.label}</option>)}
          </select>
          <input type="number" min="0" name="childrenUnder18" value={editForm.childrenUnder18 ?? ''} onChange={handleEditChange} placeholder="Enfants < 18 ans" title={t('help.childrenUnder18')} className="border p-2 rounded" />
          <input name="socialSecurityNumber" value={editForm.socialSecurityNumber || ''} onChange={handleEditChange} placeholder="N° Sécurité sociale" title={t('help.socialSecurityNumber')} inputMode="text" pattern="[0-9A-Za-z ]{12,}" spellCheck={false} className="border p-2 rounded" />
          <input type="date" name="birthDate" value={editForm.birthDate || ''} onChange={handleEditChange} className="border p-2 rounded" title={t('help.birthDate')} />
          <input type="date" name="hireDate" value={editForm.hireDate || ''} onChange={handleEditChange} className="border p-2 rounded" title={t('help.hireDate')} />
          <input type="date" name="endDate" value={editForm.endDate || ''} onChange={handleEditChange} className="border p-2 rounded" title={t('help.endDate')} />
          <input name="employeeNumber" value={editForm.employeeNumber || ''} onChange={handleEditChange} placeholder="Matricule" title={t('help.employeeNumberEdit')} className="border p-2 rounded" />
          <select name="contractType" value={editForm.contractType || ''} onChange={handleEditChange} className="border p-2 rounded" title={t('help.contractType')}>
            {CONTRACT_TYPES.map(o => <option key={o.value + o.label} value={o.value}>{o.label}</option>)}
          </select>
          <select name="status" value={editForm.status || 'ACTIVE'} onChange={handleEditChange} className="border p-2 rounded" title={t('help.status')}>
            {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select name="positionId" value={editForm.positionId || ''} onChange={handleEditChange} className="border p-2 rounded" title={t('help.positionId')}>
            <option value="">Poste</option>
            {positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          {/* Contrat supprimé */}
          <input name="category" value={editForm.category || ''} onChange={handleEditChange} placeholder="Catégorie (auto)" title={t('help.category')} className="border p-2 rounded bg-gray-100" readOnly />
          <button type="submit" className="col-span-2 bg-yellow-600 text-white py-2 rounded">Enregistrer</button>
        </form>
      )}
      <h2 className="text-xl font-semibold mb-2">Historique des changements</h2>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Employé</th>
            <th className="p-2">Type</th>
            <th className="p-2">Date</th>
            <th className="p-2">Détails</th>
          </tr>
        </thead>
        <tbody>
          {history.map(h => (
            <tr key={h.id} className="border-b">
              <td className="p-2">{h.employee?.firstName} {h.employee?.lastName}</td>
              <td className="p-2">{h.changeType}</td>
              <td className="p-2">{new Date(h.changeDate).toLocaleDateString()}</td>
              <td className="p-2">{h.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
