import Link from "next/link";
import prisma from "@/lib/prisma";

export default async function SuppliersLetteringListPage() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true }
  });
  return (
    <main className="min-h-screen pt-24 px-6 bg-gray-50">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold mb-4">Lettrage fournisseurs</h1>
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
              {suppliers.map((s) => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2">{s.email || "-"}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/suppliers/${s.id}`}
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
