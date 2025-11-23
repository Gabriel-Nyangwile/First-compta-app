"use client";
import React, { useMemo } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

export default function AnnualCharts({ months }) {
  const labels = months.map(m => `M${m.month}`);
  const lineData = useMemo(() => ({
    labels,
    datasets: [
      { label: 'Brut', data: months.map(m => m.grossTotal), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.25)', tension:0.25 },
      { label: 'Net', data: months.map(m => m.netTotal), borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.25)', tension:0.25 },
      { label: 'Corr Brut Nég', data: months.map(m => m.grossNegative), borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.25)', borderDash:[6,4], tension:0.25 },
      { label: 'Corr Net Nég', data: months.map(m => m.netNegative), borderColor: '#ea580c', backgroundColor: 'rgba(234,88,12,0.25)', borderDash:[6,4], tension:0.25 }
    ]
  }), [months]);
  const contribData = useMemo(() => ({
    labels,
    datasets: [
      { label: 'CNSS Sal', data: months.map(m => m.cnssEmployeeTotal), backgroundColor:'#1d4ed8' },
      { label: 'CNSS Emp', data: months.map(m => m.cnssEmployerTotal), backgroundColor:'#2563eb' },
      { label: 'ONEM', data: months.map(m => m.onemTotal), backgroundColor:'#4f46e5' },
      { label: 'INPP', data: months.map(m => m.inppTotal), backgroundColor:'#6366f1' }
    ]
  }), [months]);
  const chargesData = useMemo(() => ({
    labels,
    datasets: [
      { label: 'Charges Employeur', data: months.map(m => m.employerChargesTotal), backgroundColor:'#334155' },
      { label: 'Heures Sup', data: months.map(m => m.overtimeTotal), backgroundColor:'#0f766e' }
    ]
  }), [months]);
  return (
    <div className="space-y-8 mt-6">
      <div>
        <h2 className="text-sm font-semibold mb-2">Evolution Brut / Net & Corrections</h2>
        <Line data={lineData} options={{ responsive:true, plugins:{ legend:{ position:'bottom' } }, scales:{ y:{ beginAtZero:true } } }} />
      </div>
      <div>
        <h2 className="text-sm font-semibold mb-2">Contributions Sociales</h2>
        <Bar data={contribData} options={{ responsive:true, plugins:{ legend:{ position:'bottom' } }, scales:{ y:{ beginAtZero:true } }, interaction:{ mode:'index', intersect:false }, stacked:true }} />
      </div>
      <div>
        <h2 className="text-sm font-semibold mb-2">Charges Employeur & Heures Supplémentaires</h2>
        <Bar data={chargesData} options={{ responsive:true, plugins:{ legend:{ position:'bottom' } }, scales:{ y:{ beginAtZero:true } }, interaction:{ mode:'index', intersect:false } }} />
      </div>
    </div>
  );
}
