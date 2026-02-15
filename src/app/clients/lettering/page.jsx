import Link from "next/link";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { getCompanyIdFromCookies } from "@/lib/tenant";

export default async function ClientsLetteringListPage() {
  const cookieStore = await cookies();
  const companyId = getCompanyIdFromCookies(cookieStore);
  if (!companyId) {
    return <main className="min-h-screen pt-24 px-6 bg-gray-50">companyId requis (cookie company-id ou DEFAULT_COMPANY_ID).</main>;
  }
  const clients = await prisma.client.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true }
  });
  return (
    <main className="min-h-screen pt-24 px-6 bg-gray-50">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold mb-4">Lettrage clients</h1>
        <div className="bg-white rounded shadow border overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-3 py-2 text-left">Nom</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2">{c.email || "-"}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/clients/${c.id}/lettering`}
                      className="text-emerald-700 hover:underline"
                    >
                      Lettrage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
