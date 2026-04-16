#!/usr/bin/env node

/**
 * Test script for Phase 1.3b-02: Journal & Ledger Services
 * Tests the new service layer architecture
 */

import { getJournalEntries } from '../src/lib/journal/journalService.js';
import { getLedgerData } from '../src/lib/ledger/ledgerService.js';
import { validateJournalFilters } from '../src/lib/journal/journalFilters.js';
import { validateLedgerFilters } from '../src/lib/ledger/ledgerFilters.js';
import { generateJournalCSV } from '../src/lib/journal/journalExports.js';
import { generateLedgerCSV } from '../src/lib/ledger/ledgerExports.js';
import prisma from '../src/lib/prisma.js';

const COMPANY_ID = process.env.COMPANY_ID || 'DEFAULT_COMPANY_ID';

async function testJournalFilters() {
  console.log('🧪 Testing Journal Filters...');

  try {
    // Test valid filters
    const validFilters = validateJournalFilters({
      page: 1,
      pageSize: 20,
      dateFrom: '2025-01-01',
      dateTo: '2025-12-31',
      sourceType: 'INVOICE',
      q: 'test'
    });
    console.log('✅ Valid filters parsed:', validFilters);

    // Test invalid filters
    try {
      validateJournalFilters({
        page: 'invalid',
        dateFrom: 'invalid-date'
      });
    } catch (error) {
      console.log('✅ Invalid filters rejected:', error.message);
    }

  } catch (error) {
    console.error('❌ Journal filters test failed:', error);
  }
}

async function testLedgerFilters() {
  console.log('🧪 Testing Ledger Filters...');

  try {
    const validFilters = validateLedgerFilters({
      dateFrom: '2025-01-01',
      dateTo: '2025-12-31',
      q: '411',
      includeZero: false
    });
    console.log('✅ Valid ledger filters parsed:', validFilters);

  } catch (error) {
    console.error('❌ Ledger filters test failed:', error);
  }
}

async function testJournalService() {
  console.log('🧪 Testing Journal Service...');

  try {
    const result = await getJournalEntries(COMPANY_ID, {
      page: 1,
      pageSize: 5
    });

    console.log(`✅ Journal service returned ${result.items.length} entries`);
    console.log('Pagination:', result.pagination);

    if (result.items.length > 0) {
      const firstEntry = result.items[0];
      console.log('Sample entry:', {
        number: firstEntry.number,
        balanced: firstEntry.balanced,
        debit: firstEntry.debit,
        credit: firstEntry.credit
      });
    }

  } catch (error) {
    console.error('❌ Journal service test failed:', error);
  }
}

async function testLedgerService() {
  console.log('🧪 Testing Ledger Service...');

  try {
    const result = await getLedgerData(COMPANY_ID, {
      includeZero: false
    });

    console.log(`✅ Ledger service returned ${result.accounts.length} accounts`);
    console.log('Totals:', result.totals);

    if (result.accounts.length > 0) {
      const firstAccount = result.accounts[0];
      console.log('Sample account:', {
        number: firstAccount.account.number,
        label: firstAccount.account.label,
        debit: firstAccount.debit,
        credit: firstAccount.credit
      });
    }

  } catch (error) {
    console.error('❌ Ledger service test failed:', error);
  }
}

async function testExports() {
  console.log('🧪 Testing Export Functions...');

  try {
    // Test journal CSV
    const journalCSV = await generateJournalCSV(COMPANY_ID, { pageSize: 200 });
    console.log(`✅ Journal CSV generated: ${journalCSV.rows.length} rows`);

    // Test ledger CSV
    const ledgerCSV = await generateLedgerCSV(COMPANY_ID);
    console.log(`✅ Ledger CSV generated: ${ledgerCSV.rows.length} rows`);

  } catch (error) {
    console.error('❌ Export test failed:', error);
  }
}

async function runTests() {
  console.log('🚀 Starting Phase 1.3b-02 Service Tests\n');

  await testJournalFilters();
  console.log('');

  await testLedgerFilters();
  console.log('');

  await testJournalService();
  console.log('');

  await testLedgerService();
  console.log('');

  await testExports();
  console.log('');

  console.log('✅ All tests completed!');
  await prisma.$disconnect();
}

runTests().catch(console.error);