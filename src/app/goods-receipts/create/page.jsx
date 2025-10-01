import GoodsReceiptForm from '@/components/GoodsReceiptForm';

async function fetchPOs() {
  const res = await fetch(`${process.env.BASE_URL || ''}/api/purchase-orders?status=APPROVED`, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}
export default async function CreateGoodsReceiptPage() {
  const purchaseOrders = await fetchPOs();
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Nouvelle Réception</h1>
      <GoodsReceiptForm purchaseOrders={purchaseOrders} />
    </div>
  );
}
