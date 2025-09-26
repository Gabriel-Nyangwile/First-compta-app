// src/components/InvoiceTotals.jsx
import Amount from './Amount';

export default function InvoiceTotals({ totalPaid, totalPending, totalOverdue }) {
  return (
    <div className="mb-8 p-4 bg-white rounded-lg border border-gray-200 grid grid-cols-3 gap-4 text-center">
      <div className="p-3 bg-green-50 rounded-md border border-green-200">
        <p className="text-sm font-medium text-green-700">Total Payées</p>
        <p className="text-xl font-bold text-green-900 mt-1"><Amount value={totalPaid} /></p>
      </div>
      <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200">
        <p className="text-sm font-medium text-yellow-700">Total En attente</p>
        <p className="text-xl font-bold text-yellow-900 mt-1"><Amount value={totalPending} /></p>
      </div>
      <div className="p-3 bg-red-50 rounded-md border border-red-200">
        <p className="text-sm font-medium text-red-700">Total En retard</p>
        <p className="text-xl font-bold text-red-900 mt-1"><Amount value={totalOverdue} /></p>
      </div>
    </div>
  );
}
