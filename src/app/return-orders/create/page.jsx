import { absoluteUrl } from "@/lib/url";
import ReturnOrdersLayout from "@/components/returnOrders/ReturnOrdersLayout";
import ReturnOrderCreateForm from "@/components/returnOrders/ReturnOrderCreateForm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function fetchGoodsReceipt(id) {
  const url = await absoluteUrl(`/api/goods-receipts/${id}`);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function ReturnOrderCreatePage({ searchParams }) {
  const awaitedParams = await searchParams;
  const goodsReceiptId = awaitedParams?.goodsReceiptId;

  if (!goodsReceiptId) {
    return (
      <ReturnOrdersLayout>
        <div className="px-4 py-6 text-sm text-slate-600">
          Fournissez l&apos;identifiant d&apos;une réception (`goodsReceiptId`)
          pour initier un retour.
        </div>
      </ReturnOrdersLayout>
    );
  }

  const receipt = await fetchGoodsReceipt(goodsReceiptId);
  if (!receipt) {
    notFound();
  }

  return (
    <ReturnOrdersLayout>
      <div className="space-y-4">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold">
            Créer un retour depuis la réception {receipt.number}
          </h2>
          <p className="text-sm text-slate-600">
            Sélectionnez les lignes à retourner. Seules les quantités déjà
            rangées sont éligibles.
          </p>
        </header>
        <ReturnOrderCreateForm goodsReceipt={receipt} />
      </div>
    </ReturnOrdersLayout>
  );
}
