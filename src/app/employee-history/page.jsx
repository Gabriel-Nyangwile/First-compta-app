
"use client";

import { useState, useEffect } from 'react';
import BackButton from '@/components/BackButton';
import { useI18n } from '@/lib/i18n';
import LocaleSwitcher from '@/components/LocaleSwitcher';

function fetchAPI(path, options) {
  return fetch(path, options).then(r => r.json());
}

export default function EmployeeHistoryPage() {
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState({ employeeId: '', changeType: '', details: '', changeDate: '' });
  const [message, setMessage] = useState('');
  const [employees, setEmployees] = useState([]);
  const { t } = useI18n();

  useEffect(() => {
    fetchAPI('/api/employee-history').then(data => setHistory(data.history || []));
    fetchAPI('/api/employee').then(data => setEmployees(data.employees || []));
  }, [message]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleCreate(e) {
    e.preventDefault();
    const res = await fetchAPI('/api/employee-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setMessage(res.error ? res.error : 'Historique ajouté');
    setForm({ employeeId: '', changeType: '', details: '', changeDate: '' });
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-2">
        <div className="flex items-center justify-between">
          <BackButton>← Retour</BackButton>
          <LocaleSwitcher />
        </div>
      </div>
      <h1 className="text-2xl font-bold mb-4">Historique des employés</h1>
      {message && <div className="mb-2 text-green-600">{message}</div>}
      <form onSubmit={handleCreate} className="mb-6 grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded">
        <select name="employeeId" value={form.employeeId} onChange={handleChange} className="border p-2 rounded" required title={t('history.employeeId')}>
          <option value="">Employé</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
        </select>
        <select name="changeType" value={form.changeType} onChange={handleChange} className="border p-2 rounded" required title={t('history.changeType')}>
          <option value="">{t('history.changeTypeOptions.placeholder')}</option>
          <option value="PROMOTION">{t('history.changeTypeOptions.PROMOTION')}</option>
          <option value="MUTATION">{t('history.changeTypeOptions.MUTATION')}</option>
          <option value="SANCTION">{t('history.changeTypeOptions.SANCTION')}</option>
          <option value="SUSPENSION">{t('history.changeTypeOptions.SUSPENSION')}</option>
          <option value="END_CONTRACT">{t('history.changeTypeOptions.END_CONTRACT')}</option>
        </select>
        <input name="changeDate" value={form.changeDate} onChange={handleChange} type="date" className="border p-2 rounded" required title={t('history.changeDate')} />
        <input name="details" value={form.details} onChange={handleChange} placeholder="Détails" className="border p-2 rounded" title={t('history.details')} />
        <button type="submit" className="col-span-2 bg-blue-600 text-white py-2 rounded">Ajouter</button>
      </form>
      <table className="w-full border mb-8">
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
              <td className="p-2">{
                h.changeType
                  ? (t(`history.changeTypeOptions.${h.changeType}`) || h.changeType)
                  : ''
              }</td>
              <td className="p-2">{new Date(h.changeDate).toLocaleDateString()}</td>
              <td className="p-2">{h.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
