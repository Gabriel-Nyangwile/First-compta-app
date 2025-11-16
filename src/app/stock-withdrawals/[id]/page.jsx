import StockWithdrawalDetail from "@/components/stockWithdrawals/StockWithdrawalDetail";

export const dynamic = "force-dynamic";

export default function StockWithdrawalDetailPage({ params }) {
  return <StockWithdrawalDetail id={params.id} />;
}
