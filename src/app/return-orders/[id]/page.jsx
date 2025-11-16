import ReturnOrderDetail from "@/components/returnOrders/ReturnOrderDetail";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function resolveParams(paramsPromise) {
  const params = await paramsPromise;
  if (!params || !params.id) {
    return null;
  }
  return params;
}

export default async function ReturnOrderDetailPage(props) {
  const params = await resolveParams(props.params);
  if (!params?.id) {
    notFound();
  }
  return <ReturnOrderDetail orderId={params.id} />;
}
