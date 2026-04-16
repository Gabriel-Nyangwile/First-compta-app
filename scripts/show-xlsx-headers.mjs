#!/usr/bin/env node
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

const filePath = path.resolve('backups','found-by-user','_JournalEntry__202604151631.xlsx');
if(!fs.existsSync(filePath)){ console.error('Fichier introuvable:', filePath); process.exit(1); }
(async ()=>{
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.worksheets[0];
  const headers = [];
  sheet.getRow(1).eachCell((cell, colNumber)=> headers.push(String(cell.value || '').trim()));
  const outDir = path.resolve('backups','found-by-user');
  const outFile = path.join(outDir,'_JournalEntry__202604151631_headers.json');
  fs.writeFileSync(outFile, JSON.stringify(headers, null, 2));
  console.log('En-têtes détectées:');
  headers.forEach((h,i)=> console.log(`${i+1}. ${h}`));
  console.log('En-têtes sauvegardées dans', outFile);
})();
