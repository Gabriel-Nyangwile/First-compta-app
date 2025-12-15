import 'dotenv/config'
import prisma from './src/lib/prisma.js'

async function run(){
  const inv = await prisma.incomingInvoice.findFirst({
    where:{entryNumber:'EI-2025-0008'},
    include:{lines:true,transactions:true,supplier:true,assetPurchaseOrder:true}
  })
  console.log('Invoice',inv && {id:inv.id, entryNumber:inv.entryNumber, supplier:inv.supplier?.name})
  if(inv){
    console.log('Lines', inv.lines.map(l=>({desc:l.description, accountId:l.accountId, total:l.lineTotal.toString()})))
    console.log('Txns', inv.transactions.map(t=>({dir:t.direction, kind:t.kind, amt:t.amount.toString(), acc:t.accountId})))
    console.log('APO', inv.assetPurchaseOrder?.number)
  }
  const po = await prisma.assetPurchaseOrder.findFirst({where:{number:'APO-000008'}, include:{lines:{include:{assetCategory:true}}, incomingInvoice:true}})
  console.log('PO', po && {id:po.id, status:po.status, inv:po.incomingInvoice?.entryNumber})
  if(po) console.log('PO lines', po.lines.map(l=>({label:l.label, cat:l.assetCategory?.code, qty:l.quantity.toString(), pu:l.unitPrice.toString()})))
}
run().catch(console.error).finally(async()=>{await prisma.$disconnect()})
