import 'dotenv/config'
import prisma from './src/lib/prisma.js'

async function main(){
  const assets = await prisma.asset.findMany({where:{label:{contains:'Bétonnier'}}, include:{category:true}})
  console.log(assets.map(a=>({id:a.id, ref:a.ref, cat:a.category?.code, cost:a.cost.toString(), status:a.status})))
}
main().catch(console.error).finally(async()=>{await prisma.$disconnect()})
