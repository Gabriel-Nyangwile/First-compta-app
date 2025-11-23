#!/usr/bin/env node
/* Test XLSX trend export (ESM) */
import assert from 'assert';
import Excel from 'exceljs';

async function main(){
  const base = process.env.BASE_URL || 'http://localhost:3000';
  const url = base + '/api/personnel/trend/xlsx?months=6';
  const token = process.env.ADMIN_TOKEN || process.env.NEXT_PUBLIC_ADMIN_TOKEN;
  const res = await fetch(url, { headers: token ? { 'x-admin-token': token } : {} });
  assert(res.ok, 'HTTP status not OK: '+res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  assert(buf.slice(0,2).toString() === 'PK', 'XLSX ZIP signature missing');
  const wb = new Excel.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet('Trend');
  assert(ws, 'Worksheet Trend not found');
  const dataRowCount = ws.actualRowCount - 1;
  assert(dataRowCount === 6, 'Expected 6 rows, got '+dataRowCount);
  const headers = ws.getRow(1).values.slice(1);
  const expected = ['Year','Month','ActiveStart','ActiveEnd','AvgHeadcount','Hires','Exits','HiresRatePct','ExitTurnoverPct'];
  assert.deepStrictEqual(headers, expected, 'Header mismatch');
  for (let i=2;i<=ws.actualRowCount;i++){
    const row = ws.getRow(i).values.slice(1);
    assert(row.length === expected.length, 'Column count mismatch row '+i);
    assert(Number.isInteger(row[0]), 'Year not integer');
    assert(Number.isInteger(row[1]), 'Month not integer');
    // activeStart activeEnd non-negative
    assert(row[2] >= 0 && row[3] >= 0, 'Active counts negative');
    assert(row[4] >= 0, 'AvgHeadcount negative');
    assert(row[7] <= 500 && row[8] <= 500, 'Rates out of plausible range');
  }
  console.log('OK personnel trend xlsx');
}

main().catch(e=>{ console.error(e); process.exit(1); });
