// app/invoices/create/page.js

"use client";
import { useState, useEffect } from "react";
import Amount from '@/components/Amount';
import AccountAutocomplete from "@/components/AccountAutocomplete";
import { useRouter } from "next/navigation";
import ClientNameAutocomplete from "@/components/ClientNameAutocomplete";

export default function CreateInvoicePage() {
  const [clients, setClients] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [clientId, setClientId] = useState("");
  const [showNewClient, setShowNewClient] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [linkClient, setLinkClient] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    account: null,
  });
  const [creatingClient, setCreatingClient] = useState(false);
  const [vat, setVat] = useState(0.2);
  const [lines, setLines] = useState([
    {
      description: "",
      accountId: "",
      unitOfMeasure: "",
      quantity: 1,
      unitPrice: 0,
      lineTotal: 0,
    },
  ]);
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  // Fonction utilitaire pour obtenir le délai en jours selon la catégorie
  function getDelayFromCategory(category) {
    switch (category) {
      case "CASH":
        return 0;
      case "DAYS_15":
        return 15;
      case "DAYS_30":
        return 30;
      case "DAYS_45":
        return 45;
      default:
        return 30;
    }
  }

  // Calcul automatique de la date d'échéance quand clientId ou issueDate change
  useEffect(() => {
    if (!clientId || !issueDate) return;
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    const delay = getDelayFromCategory(client.category);
    const date = new Date(issueDate);
    date.setDate(date.getDate() + delay);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    setDueDate(`${yyyy}-${mm}-${dd}`);
  }, [clientId, issueDate, clients]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Charger clients et comptes au chargement
  useEffect(() => {
    fetch("/api/clients")
      .then((res) => res.json())
      .then((data) => {
        // L'API renvoie { clients: [...] } désormais
        if (Array.isArray(data)) {
          setClients(data);
        } else if (Array.isArray(data.clients)) {
          setClients(data.clients);
        } else {
          setClients([]);
        }
      })
      .catch(() => setClients([]));
    fetch("/api/accounts")
      .then((res) => res.json())
      .then((data) => setAccounts(data));
    // Pré-remplir le numéro de facture automatiquement
    fetch("/api/invoices/next-number")
      .then((res) => res.json())
      .then((data) => setInvoiceNumber(data.invoiceNumber));
    // Pré-remplir la date d'émission avec la date du jour (format yyyy-mm-dd)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setIssueDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  // plus de filtrage, on affiche tous les clients dans le select

  // Calculs dynamiques
  const totalAmountHt = lines.reduce(
    (sum, l) => sum + Number(l.unitPrice) * Number(l.quantity),
    0
  );
  const vatAmount = Number(vat) * totalAmountHt;
  const totalAmount = totalAmountHt + vatAmount;

  // Gestion des lignes dynamiques
  const handleLineChange = (idx, field, value) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      // Recalcule le total de la ligne
      updated[idx].lineTotal =
        Number(updated[idx].unitPrice) * Number(updated[idx].quantity);
      return updated;
    });
  };
  const addLine = () =>
    setLines([
      ...lines,
      {
        description: "",
        accountId: "",
        unitOfMeasure: "",
        quantity: 1,
        unitPrice: 0,
        lineTotal: 0,
      },
    ]);
  const removeLine = (idx) =>
    setLines(lines.length > 1 ? lines.filter((_, i) => i !== idx) : lines);

  // Soumission du formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber,
          clientId,
          issueDate,
          dueDate,
          vat,
          invoiceLines: lines,
        }),
      });
      if (res.ok) {
        router.push("/transactions");
      } else {
        alert("Erreur lors de la création de la facture");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-100">
      <div className="w-full max-w-2xl bg-white p-8 rounded-lg shadow-md border border-gray-200">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Créer une nouvelle facture
        </h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="invoiceNumber" className="block text-sm font-medium text-gray-700 mb-1">Numéro de facture</label>
            <input
              type="text"
              id="invoiceNumber"
              name="invoiceNumber"
              required
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
              placeholder="INV-2025-001"
            />
          </div>
          {/* <div>
                  <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                  <div className="flex gap-2 items-center">
                    <select
                      id="clientId"
                      name="clientId"
                      required
                      value={clientId}
                      onChange={e => setClientId(e.target.value)}
                      className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out bg-white"
                    >
                      <option value="">Sélectionner un client</option>
                      {clients.map(client => (
                        <option key={client.id} value={client.id}>
                          {client.name} {client.account?.number ? `- ${client.account.number}` : ""}
                        </option>
                      ))}
                    </select>
                  </div> 
              */}
          <>
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={linkClient}
                onChange={(e) => setLinkClient(e.target.checked)}
                className="form-checkbox h-4 w-4 text-blue-600"
              />
              <span className="ml-2 text-sm text-gray-700">
                Associer un client{" "}
              </span>
            </label>

            {linkClient && (
              <>
                <label
                  htmlFor="clientId"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Nom du client
                </label>
                <ClientNameAutocomplete
                  key={clientId || 'no-client'}
                  value={(Array.isArray(clients) ? clients : []).find((c) => c.id === clientId) || null}
                  onChange={(clientObj) => setClientId(clientObj?.id || "")}
                  maxLength={20}
                />
                {/* Champ caché pour soumettre la valeur */}
                <input type="hidden" name="clientId" value={clientId} />
              </>
            )}
            {/* <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out"
              placeholder="Nom du client"
            />
          </div> */}

            {!clientId && (
              <button
                type="button"
                className="text-blue-600 underline text-sm"
                onClick={() => setShowNewClient(true)}
              >
                + Nouveau client
              </button>
            )}
          </>

          {/* Affichage du numéro de compte du client sélectionné */}
          {linkClient && clientId && (
            <div className="text-sm text-gray-500 mt-1">
              Compte client : {(() => {
                const list = Array.isArray(clients) ? clients : [];
                const client = list.find(c => c.id === clientId);
                if (client && client.account && client.account.number) return client.account.number;
                // Si le client vient d'être créé, il peut ne pas être dans la liste clients
                if (newClient && newClient.account && newClient.account.number && clientId === newClient.id) return newClient.account.number;
                return "-";
              })()}
            </div>
          )}

          {/* Modale création client */}
          {showNewClient && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded shadow-lg w-full max-w-sm">
                <h2 className="text-lg font-bold mb-4">Nouveau client</h2>
                <input
                  type="text"
                  placeholder="Nom du client"
                  className="w-full mb-2 px-2 py-1 border rounded"
                  value={newClient.name}
                  onChange={(e) =>
                    setNewClient({ ...newClient, name: e.target.value })
                  }
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full mb-2 px-2 py-1 border rounded"
                  value={newClient.email}
                  onChange={(e) =>
                    setNewClient({ ...newClient, email: e.target.value })
                  }
                />
                <div className="mb-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Compte comptable
                  </label>
                  <AccountAutocomplete
                    value={newClient.account}
                    onChange={(acc) =>
                      setNewClient({ ...newClient, account: acc })
                    }
                  />
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                    disabled={creatingClient || !newClient.name || (newClient.account && !newClient.account.id)}
                    onClick={async () => {
                      if (!newClient.name) return;
                      setCreatingClient(true);
                      try {
                        const cliRes = await fetch("/api/clients", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            name: newClient.name,
                            email: newClient.email,
                            accountId: newClient.account?.id,
                          }),
                        });
                        const payload = await cliRes.json();
                        if (!cliRes.ok) {
                          alert(payload.error || "Erreur lors de la création du client");
                          return;
                        }
                        setClients(prev => [
                          ...prev,
                          { ...payload, account: newClient.account }
                        ]);
                        setClientId(payload.id);
                        setShowNewClient(false);
                        setNewClient({ name: "", email: "", account: null });
                      } catch (err) {
                        alert("Erreur réseau");
                      } finally {
                        setCreatingClient(false);
                      }
                    }}
                  >
                    {creatingClient ? 'Création...' : 'Créer'}
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 rounded border"
                    onClick={() => setShowNewClient(false)}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lignes de facture
            </label>
            {lines.map((line, idx) => (
              <div
                key={idx}
                className="flex flex-wrap gap-2 items-end border-b pb-2 mb-2"
              >
                <input
                  type="text"
                  placeholder="Description"
                  value={line.description}
                  onChange={(e) =>
                    handleLineChange(idx, "description", e.target.value)
                  }
                  className="w-32 px-2 py-1 border rounded"
                  required
                />
                 <div className="w-32">
                   <AccountAutocomplete
                     value={accounts.find(a => a.id === line.accountId) || null}
                     onChange={accObj => handleLineChange(idx, "accountId", accObj?.id || "")}
                     maxLength={20}
                   />
                 </div>
                <input
                  type="text"
                  placeholder="Unité"
                  value={line.unitOfMeasure}
                  onChange={(e) =>
                    handleLineChange(idx, "unitOfMeasure", e.target.value)
                  }
                  className="w-20 px-2 py-1 border rounded"
                  required
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Quantité"
                  value={line.quantity}
                  onChange={(e) =>
                    handleLineChange(idx, "quantity", e.target.value)
                  }
                  className="w-20 px-2 py-1 border rounded"
                  required
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Prix unitaire"
                  value={line.unitPrice}
                  onChange={(e) =>
                    handleLineChange(idx, "unitPrice", e.target.value)
                  }
                  className="w-24 px-2 py-1 border rounded"
                  required
                />
                <span className="w-24 text-right font-semibold">
                  <Amount value={line.lineTotal} />
                </span>
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="text-red-500 px-2"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addLine}
              className="text-blue-600 font-semibold"
            >
              + Ajouter une ligne
            </button>
          </div>
          <div className="flex gap-4 items-center mt-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Taux de TVA (%)
              </label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div className="flex-1 text-right">
              <div>
                Total HT : <span className="font-bold"><Amount value={totalAmountHt} /></span>
              </div>
              <div>
                TVA : <span className="font-bold"><Amount value={vatAmount} /></span>
              </div>
              <div>
                Total TTC : <span className="font-bold"><Amount value={totalAmount} /></span>
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date d'émission
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date d'échéance
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
          >
            {loading ? "Création..." : "Créer la facture"}
          </button>
        </form>
      </div>
    </main>
  );
}
