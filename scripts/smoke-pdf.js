// Simple smoke test to exercise PDF generation routes locally.
// Usage: node scripts/smoke-pdf.js <invoiceId>
// Requires the dev server running on localhost:3000.

import fs from 'fs';

const id = process.argv[2];
if (!id) {
  console.error('Provide an invoice id: node scripts/smoke-pdf.js <invoiceId>');
  process.exit(1);
}

const url = `http://localhost:3000/api/invoice/${id}/pdf`;

fetch(url).then(async res => {
  if (!res.ok) {
    console.error('Request failed', res.status);
    process.exit(2);
  }
  const arrayBuffer = await res.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  // Quick magic number check for PDF (%PDF-)
  const signature = new TextDecoder().decode(bytes.slice(0,5));
  if (!signature.startsWith('%PDF-')) {
    console.error('Not a PDF payload, signature =', signature);
    process.exit(3);
  }
  const out = `smoke-invoice-${id}.pdf`;
  fs.writeFileSync(out, Buffer.from(bytes));
  console.log('PDF OK ->', out, 'size:', bytes.length, 'bytes');
}).catch(e => {
  console.error('Fetch error', e);
  process.exit(4);
});
