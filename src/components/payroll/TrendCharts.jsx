"use client";
import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function TrendCharts({ years }) {
  const labels = years.map(y => String(y.year));
  const data = useMemo(() => ({
    labels,
    datasets: [
      { label:'Brut', data: years.map(y => y.totals.gross), backgroundColor:'#2563eb' },
      { label:'Net', data: years.map(y => y.totals.net), backgroundColor:'#16a34a' },
      { label:'Corrections Brut', data: years.map(y => y.totals.corrGross), backgroundColor:'#dc2626' },
      { label:'Corrections Net', data: years.map(y => y.totals.corrNet), backgroundColor:'#ea580c' },
      { label:'Charges Employeur', data: years.map(y => y.totals.charges), backgroundColor:'#334155' },
    ]
  }), [years]);
  return (
    <div className="space-y-6 mt-6">
      <div>
        <h2 className="text-sm font-semibold mb-2">Comparatif Annuel (Brut / Net / Corrections / Charges)</h2>
        <Bar data={data} options={{ responsive:true, plugins:{ legend:{ position:'bottom' } }, interaction:{ mode:'index', intersect:false } }} />
      </div>
    </div>
  );
}
