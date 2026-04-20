import { cookies } from "next/headers";
import { getCompanyIdFromCookies } from "@/lib/tenant";
import { getCompanyCurrency } from "@/lib/companyContext";
import BankAdvicesPageClient from "@/components/treasury/BankAdvicesPageClient.jsx";

export default async function BankAdvicesPage() {
  const companyId = getCompanyIdFromCookies(await cookies());
  const defaultCurrency = await getCompanyCurrency(companyId);
  return <BankAdvicesPageClient defaultCurrency={defaultCurrency} />;
}
