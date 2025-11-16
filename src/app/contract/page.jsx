"use client";
import BackButton from '@/components/BackButton';

export default function ContractPage() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-2"><BackButton>← Retour</BackButton></div>
      <h1 className="text-2xl font-bold mb-4">Contrats</h1>
      <div className="p-4 rounded bg-yellow-50 border border-yellow-200 text-yellow-900">
        La gestion des contrats a été supprimée. Utilisez désormais le champ « Type de contrat » sur les employés.
      </div>
    </div>
  );
}
