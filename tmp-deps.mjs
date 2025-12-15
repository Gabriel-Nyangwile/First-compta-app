import 'dotenv/config'
import prisma from './src/lib/prisma.js'

async function main(){
  const assetId='880006e3-f57e-4f35-afe0-65b40abba349'
  const deps=await prisma.depreciationLine.findMany({where:{assetId}, orderBy:[{year:'asc'},{month:'asc'}]})
  console.log(deps.map(d=>({ym:`${d.year}-${d.month}`, status:d.status, amount:d.amount.toString()})))
}
main().catch(console.error).finally(async()=>{await prisma.$disconnect()})
