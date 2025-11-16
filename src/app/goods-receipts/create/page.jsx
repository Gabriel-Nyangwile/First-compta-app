import GoodsReceiptForm from '@/components/GoodsReceiptForm';
import { absoluteUrl } from '@/lib/url';

async function fetchApprovedPurchaseOrders() {
  const url = await absoluteUrl('/api/purchase-orders?status=APPROVED');
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

async function fetchPurchaseOrderDetail(id) {
  if (!id) return null;
  const url = await absoluteUrl(`/api/purchase-orders/${id}`);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export default async function CreateGoodsReceiptPage(props) {
  const awaitedSearch = await props.searchParams;
  const purchaseOrderId = awaitedSearch?.purchaseOrderId || awaitedSearch?.poId || '';

  const purchaseOrders = await fetchApprovedPurchaseOrders();
  let selectedPurchaseOrder = purchaseOrderId ? purchaseOrders.find(po => po.id === purchaseOrderId) : null;

  if (purchaseOrderId && !selectedPurchaseOrder) {
    selectedPurchaseOrder = await fetchPurchaseOrderDetail(purchaseOrderId);
  }

  const mergedPurchaseOrders = (() => {
    if (selectedPurchaseOrder && !purchaseOrders.some(po => po.id === selectedPurchaseOrder.id)) {
      return [selectedPurchaseOrder, ...purchaseOrders];
    }
    return purchaseOrders;
  })();

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Nouvelle Réception</h1>
      <GoodsReceiptForm
        purchaseOrders={mergedPurchaseOrders}
        initialPurchaseOrderId={purchaseOrderId}
        initialPurchaseOrder={selectedPurchaseOrder}
      />
    </div>
  );
}
