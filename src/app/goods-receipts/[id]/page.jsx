import { absoluteUrl } from "@/lib/url";
import Link from "next/link";
import GoodsReceiptDetail from "@/components/GoodsReceiptDetail";

async function fetchReceipt(id) {
  const url = await absoluteUrl(`/api/goods-receipts/${id}`);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export const dynamic = "force-dynamic";

export default async function GoodsReceiptDetailPage(props) {
  const awaited = await props.params;
  const { id } = awaited;
  const receipt = await fetchReceipt(id);
  if (!receipt) {
    return <div className="p-6">Réception introuvable.</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Réception {receipt.number}</h1>
        <span className="px-2 py-1 text-xs rounded bg-gray-200">
          {receipt.status}
        </span>
        <Link
          href="/return-orders"
          className="ml-auto text-sm text-blue-600 underline"
        >
          Voir les retours fournisseurs
        </Link>
      </div>
      <GoodsReceiptDetail receipt={receipt} />
    </div>
  );
}
