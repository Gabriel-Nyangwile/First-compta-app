// API d'audit stock : lance le script d'audit et retourne le résultat
import { NextResponse } from 'next/server';
import { exec } from 'child_process';

export async function GET() {
  return new Promise((resolve) => {
    exec('node scripts/audit-stock.js', { cwd: process.cwd() }, (err, stdout, stderr) => {
      if (err) {
        resolve(NextResponse.json({ ok: false, issues: [stderr || err.message] }, { status: 200 }));
        return;
      }
      // On suppose que le script écrit les anomalies ligne par ligne, ou "OK" si aucune
      const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 1 && lines[0].toLowerCase().includes('ok')) {
        resolve(NextResponse.json({ ok: true, issues: [] }, { status: 200 }));
      } else {
        resolve(NextResponse.json({ ok: false, issues: lines }, { status: 200 }));
      }
    });
  });
}
