"use client";
import { useState } from 'react';

export default function ExportPayslipJson({ payslip }) {
  const [busy, setBusy] = useState(false);
  function handleExport() {
    if (!payslip) return;
    setBusy(true);
    try {
      const blob = new Blob([JSON.stringify(payslip, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `payslip_${payslip.ref || payslip.id}.json`; a.click();
      URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  }
  return <button onClick={handleExport} disabled={busy} className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50 transition-colors">{busy? 'Export...' : 'Exporter JSON'}</button>;
}
