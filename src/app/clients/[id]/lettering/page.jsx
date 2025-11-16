import { ClientLetteringPanel } from "@/components/clients/lettering/ClientLetteringPanel";
import prisma from "@/lib/prisma";
import Link from "next/link";

export default async function ClientDetailLetteringPage({ params }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id },
    select: { id: true, name: true, email: true }
  });
  if (!client) return <div className="p-8">Client introuvable</div>;
  return (
    <main className="min-h-screen pt-24 px-6 bg-gray-50">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-2xl font-bold">Lettrage client</h1>
          <span className="text-lg font-semibold text-gray-700">{client.name}</span>
          <Link href={`/clients`} className="ml-auto bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm">Retour</Link>
        </div>
        <ClientLetteringPanel clientId={id} />
      </div>
    </main>
  );
}
