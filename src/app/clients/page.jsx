// app/clients/page.js

"use client";
import Link from 'next/link';
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ClientList from '@/components/ClientList';


// Ce composant est un Server Component.
// Il peut accéder directement à la base de données.


export default function ClientsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [clients, setClients] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      router.push("/auth/signin");
    } else {
      setUser(JSON.parse(stored));
      fetch("/api/clients")
        .then(res => res.json())
        .then(data => {
          setClients(data.clients || []);
        });
    }
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center p-8 bg-gray-50">
      <div className="w-full max-w-2xl bg-white p-8 rounded-lg shadow-md border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Liste des Clients</h1>
          <Link href="/clients/create" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-150 ease-in-out">
            Ajouter un nouveau client
          </Link>
        </div>
        <ClientList clients={clients} />
      </div>
    </main>
  );
}
