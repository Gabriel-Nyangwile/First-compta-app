#!/usr/bin/env node
/**
 * Rebuild transactions from source documents (Invoices, IncomingInvoices, MoneyMovements, etc)
 * This script recreates the Transaction table based on existing journal entries and their sources.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting: Rebuild transactions from journal entry sources...');

  let created = 0;
  let errors = 0;

  // Fetch all journal entries with their metadata
  const journalEntries = await prisma.journalEntry.findMany({
    orderBy: { date: 'asc' },
  });

  console.log(`Found ${journalEntries.length} journal entries`);

  for (const je of journalEntries) {
    try {
      // Determine which source to pull transaction data from
      let sourceData = null;

      if (je.sourceType === 'INVOICE' && je.sourceId) {
        sourceData = await prisma.invoice.findUnique({
          where: { id: je.sourceId },
          include: { invoiceLines: true, client: true },
        });
      } else if (je.sourceType === 'INCOMING_INVOICE' && je.sourceId) {
        // IncomingInvoice relation is `lines` in the schema
        sourceData = await prisma.incomingInvoice.findUnique({
          where: { id: je.sourceId },
          include: { lines: true, supplier: true },
        });
      } else if (je.sourceType === 'MONEY_MOVEMENT' && je.sourceId) {
        sourceData = await prisma.moneyMovement.findUnique({
          where: { id: je.sourceId },
          include: { invoice: true, incomingInvoice: true },
        });
      }

      if (!sourceData) {
        console.log(`⚠️  No source data found for JE ${je.number} (${je.sourceType}:${je.sourceId}) - trying related records fallback`);

        // Fallback: try to find related records that reference this journalEntryId
        // and synthesize transactions from them (inventory counts, depreciation, asset disposals, etc.)
        const invLine = await prisma.inventoryCountLine.findFirst({ where: { journalEntryId: je.id }, include: { product: true } });
        const depLine = await prisma.depreciationLine.findFirst({ where: { journalEntryId: je.id }, include: { asset: true } });
        const assetDisp = await prisma.assetDisposal.findFirst({ where: { journalEntryId: je.id }, include: { asset: true } });

        if (invLine) {
          const val = Number(invLine.deltaValue ?? 0);
          if (val !== 0) {
            const product = invLine.product;
            const inventoryAccountId = product?.inventoryAccountId;
            const stockVarAccountId = product?.stockVariationAccountId;
            const amount = Math.abs(val);
            // Debit inventory (asset) and credit stock variation (expense/charge) for positive delta
            if (inventoryAccountId && stockVarAccountId) {
              await prisma.transaction.create({ data: {
                companyId: je.companyId,
                date: je.date,
                direction: 'DEBIT',
                kind: 'INVENTORY_ASSET',
                accountId: inventoryAccountId,
                amount,
                description: `Inventory count ${invLine.inventoryCountId} - product ${product?.id}`,
                journalEntryId: je.id,
                },
              });
              await prisma.transaction.create({ data: {
                companyId: je.companyId,
                date: je.date,
                direction: 'CREDIT',
                kind: 'STOCK_VARIATION',
                accountId: stockVarAccountId,
                amount,
                description: `Inventory count ${invLine.inventoryCountId} - product ${product?.id}`,
                journalEntryId: je.id,
                },
              });
              console.log(`✓ Synthesized inventory transactions for inventoryCountLine ${invLine.id}`);
              created += 2;
            }
          }
          continue;
        }

        if (depLine) {
          const amt = Number(depLine.amount ?? 0);
          if (amt !== 0) {
            const asset = depLine.asset;
            const expenseAccountId = asset?.expenseAccountId || asset?.depreciationAccountId;
            const reserveAccountId = asset?.depreciationAccountId;
            const amount = Math.abs(amt);
            if (expenseAccountId && reserveAccountId) {
              await prisma.transaction.create({ data: {
                companyId: je.companyId,
                date: je.date,
                direction: 'DEBIT',
                kind: 'ASSET_DEPRECIATION_EXPENSE',
                accountId: expenseAccountId,
                amount,
                description: `Depreciation ${asset?.id} - ${depLine.year}/${depLine.month}`,
                journalEntryId: je.id,
              }});
              await prisma.transaction.create({ data: {
                companyId: je.companyId,
                date: je.date,
                direction: 'CREDIT',
                kind: 'ASSET_DEPRECIATION_RESERVE',
                accountId: reserveAccountId,
                amount,
                description: `Depreciation reserve ${asset?.id}`,
                journalEntryId: je.id,
              }});
              console.log(`✓ Synthesized depreciation transactions for depreciationLine ${depLine.id}`);
              created += 2;
            }
          }
          continue;
        }

        if (assetDisp) {
          const proceed = Number(assetDisp.proceed ?? 0);
          const gainLoss = Number(assetDisp.gainLoss ?? 0);
          const asset = assetDisp.asset;
          if (proceed && asset?.disposalGainAccountId) {
            await prisma.transaction.create({ data: {
              companyId: je.companyId,
              date: je.date,
              direction: 'DEBIT',
              kind: 'PAYMENT',
              accountId: asset.disposalGainAccountId,
              amount: Math.abs(proceed),
              description: `Asset disposal proceed ${assetDisp.id}`,
              journalEntryId: je.id,
            }});
            created++;
          }
          if (gainLoss && asset?.disposalGainAccountId) {
            const kind = gainLoss > 0 ? 'ASSET_DISPOSAL_GAIN' : 'ASSET_DISPOSAL_LOSS';
            await prisma.transaction.create({ data: {
              companyId: je.companyId,
              date: je.date,
              direction: gainLoss > 0 ? 'CREDIT' : 'DEBIT',
              kind,
              accountId: gainLoss > 0 ? asset.disposalGainAccountId : asset.disposalLossAccountId,
              amount: Math.abs(gainLoss),
              description: `Asset disposal gain/loss ${assetDisp.id}`,
              journalEntryId: je.id,
            }});
            created++;
          }
          continue;
        }

        // If still no related data, log and continue
        console.log(`⚠️  Fallback: no related records found for JE ${je.number}`);
        continue;
      }

      // Create transactions based on source type
      if (je.sourceType === 'INVOICE' && sourceData.invoiceLines) {
        // Create transactions for invoice lines
        for (const line of sourceData.invoiceLines) {
          // SALE transaction
          if (line.accountId) {
            await prisma.transaction.create({
              data: {
                companyId: je.companyId,
                date: je.date,
                direction: 'CREDIT',
                kind: 'SALE',
                accountId: line.accountId,
                amount: line.lineTotal,
                description: `Invoice ${sourceData.invoiceNumber}: ${line.description}`,
                invoiceId: sourceData.id,
                invoiceLineId: line.id,
                clientId: sourceData.clientId,
                journalEntryId: je.id,
              },
            });
            console.log(`✓ Created SALE transaction for invoice line ${line.id}`);
            created++;
          }
        }

        // RECEIVABLE transaction for total due
        const receivableAccount = await prisma.account.findFirst({
          where: { companyId: je.companyId, number: { startsWith: '41' } }, // Client AR account
        });
        if (receivableAccount) {
          await prisma.transaction.create({
            data: {
              companyId: je.companyId,
              date: je.date,
              direction: 'DEBIT',
              kind: 'RECEIVABLE',
              accountId: receivableAccount.id,
              amount: sourceData.totalAmountHt,
              description: `Invoice ${sourceData.invoiceNumber} - Client receivable`,
              invoiceId: sourceData.id,
              clientId: sourceData.clientId,
              journalEntryId: je.id,
            },
          });
          console.log(`✓ Created RECEIVABLE transaction for invoice ${sourceData.invoiceNumber}`);
          created++;
        }

        // VAT transaction if applicable
        if (sourceData.vatAmount && sourceData.vatAmount > 0) {
          const vatAccount = await prisma.account.findFirst({
            where: { companyId: je.companyId, number: '44571' }, // VAT collected
          });
          if (vatAccount) {
            await prisma.transaction.create({
              data: {
                companyId: je.companyId,
                date: je.date,
                direction: 'CREDIT',
                kind: 'VAT_COLLECTED',
                accountId: vatAccount.id,
                amount: sourceData.vatAmount,
                description: `Invoice ${sourceData.invoiceNumber} - VAT`,
                invoiceId: sourceData.id,
                journalEntryId: je.id,
              },
            });
            console.log(`✓ Created VAT_COLLECTED transaction for invoice ${sourceData.invoiceNumber}`);
            created++;
          }
        }
      } else if (je.sourceType === 'INCOMING_INVOICE' && sourceData.lines) {
        // Create transactions for purchase invoice lines
        for (const line of sourceData.lines) {
          // PURCHASE transaction
          if (line.accountId) {
            await prisma.transaction.create({
              data: {
                companyId: je.companyId,
                date: je.date,
                direction: 'DEBIT',
                kind: 'PURCHASE',
                accountId: line.accountId,
                amount: line.lineTotal,
                description: `Incoming Invoice ${sourceData.entryNumber}: ${line.description}`,
                incomingInvoiceId: sourceData.id,
                incomingInvoiceLineId: line.id,
                supplierId: sourceData.supplierId,
                journalEntryId: je.id,
              },
            });
            console.log(`✓ Created PURCHASE transaction for incoming invoice line ${line.id}`);
            created++;
          }
        }

        // PAYABLE transaction for total due
        const payableAccount = await prisma.account.findFirst({
          where: { companyId: je.companyId, number: { startsWith: '401' } }, // Supplier AP account
        });
        if (payableAccount) {
          await prisma.transaction.create({
            data: {
              companyId: je.companyId,
              date: je.date,
              direction: 'CREDIT',
              kind: 'PAYABLE',
              accountId: payableAccount.id,
              amount: sourceData.totalAmountHt,
              description: `Incoming Invoice ${sourceData.entryNumber} - Supplier payable`,
              incomingInvoiceId: sourceData.id,
              supplierId: sourceData.supplierId,
              journalEntryId: je.id,
            },
          });
          console.log(`✓ Created PAYABLE transaction for incoming invoice ${sourceData.entryNumber}`);
          created++;
        }

        // VAT transaction if applicable
        if (sourceData.vatAmount && sourceData.vatAmount > 0) {
          const vatAccount = await prisma.account.findFirst({
            where: { companyId: je.companyId, number: '44566' }, // VAT deductible
          });
          if (vatAccount) {
            await prisma.transaction.create({
              data: {
                companyId: je.companyId,
                date: je.date,
                direction: 'DEBIT',
                kind: 'VAT_DEDUCTIBLE',
                accountId: vatAccount.id,
                amount: sourceData.vatAmount,
                description: `Incoming Invoice ${sourceData.entryNumber} - VAT`,
                incomingInvoiceId: sourceData.id,
                journalEntryId: je.id,
              },
            });
            console.log(`✓ Created VAT_DEDUCTIBLE transaction for incoming invoice ${sourceData.entryNumber}`);
            created++;
          }
        }
      } else if (je.sourceType === 'MONEY_MOVEMENT' && sourceData) {
        // Create payment transactions
        const bankAccount = sourceData.moneyAccountId ? await prisma.account.findFirst({
          where: { id: sourceData.moneyAccountId },
        }) : null;

        if (bankAccount) {
          const direction = sourceData.direction === 'IN' ? 'DEBIT' : 'CREDIT';
          await prisma.transaction.create({
            data: {
              companyId: je.companyId,
              date: je.date,
              direction,
              kind: 'PAYMENT',
              accountId: bankAccount.id,
              amount: sourceData.amount,
              description: `Payment: ${sourceData.kind}`,
              moneyMovementId: sourceData.id,
              journalEntryId: je.id,
            },
          });
          console.log(`✓ Created PAYMENT transaction for money movement ${sourceData.id}`);
          created++;
        }
      }
    } catch (err) {
      console.error(`❌ Error processing JE ${je.number}:`, err.message);
      errors++;
    }
  }

  console.log(`\n✅ Rebuild complete. Created ${created} transactions. Errors: ${errors}`);
  process.exit(errors > 0 ? 1 : 0);
}

main()
  .catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
