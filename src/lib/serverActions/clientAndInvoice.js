// src/lib/serverActions/clientAndInvoice.js
'use server';

import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getPaymentDays } from '@/lib/validation/client';


// getPaymentDays maintenant centralisé dans lib/validation/client.js

// NOTE: Les opérations client (création, mise à jour, suppression) ont été migrées vers les routes REST:
// - POST   /api/clients
// - GET    /api/clients/[id]
// - PUT    /api/clients/[id]
// - DELETE /api/clients/[id]
// La logique upsert côté server action est supprimée pour éviter toute divergence.

// Méthode pour créer une facture
export async function createInvoice(formData) {
  const invoiceNumber = formData.get('invoiceNumber');
  const totalAmount = parseFloat(formData.get('totalAmount'));
  const clientId = formData.get('clientId');
  /* const issueDateString = formData.get('issueDate'); 
  const issueDate = issueDateString ? new Date(issueDateString) : new Date();
 */

  if (!invoiceNumber || isNaN(totalAmount) || !clientId) {
    return { error: 'Numéro, montant et client sont requis.' };
  }

  // --- NOUVEAU : Récupérer le client pour sa catégorie ---
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { category: true }, // Ne récupérer que la catégorie
  });

  if (!client) {
    return { error: 'Client introuvable.' };
  }

  const paymentDays = getPaymentDays(client.category);

  // pour calculer la `dueDate`, mais pour la simplicité et le `@default(now())`, c'est acceptable.
  const baseDateForDueDateCalculation = new Date(); 

  // Calcul de la dueDate (par exemple, 30 jours après la date de base)
  const dueDate = new Date(baseDateForDueDateCalculation);
  dueDate.setDate(baseDateForDueDateCalculation.getDate() + paymentDays); // Ajoute le nombre de jours selon la catégorie

  
  try {
    await prisma.invoice.create({
      data: {
        invoiceNumber,
        totalAmount,
        clientId,
        //issueDate est commenté car défaut @default(now())
        dueDate,//calculée ci-dessus
      },
    });
    // Invalider le cache et re-rendre la page des factures
    revalidatePath('/invoices');
    redirect('/invoices');

    //return { success: true };
  } catch (error) {
    console.error('Erreur lors de la création de la facture:', error);
    return { error: 'Erreur inattendue lors de la création de la facture.' };
  }
  

}

// Méthode pour récupérer les clients et les factures
export async function fetchClientsAndInvoices(filters = {}) {

  const {
    query,
    status,
    clientId,
    dateField,
    startDate,
    endDate
  } = filters;

  // Construction dynamique des conditions where
  const whereClause = {
    //Filtrage par statut
    ...(status && status !== 'ALL' && {status: status === 'OVERDUE' ? 'PENDING' : status}),
    //Filtrage par client
    ...(clientId && clientId !== 'ALL' && {clientId: clientId}),
    //Recherche textuelle (numéro de facture OU nom de client)
    ...(query && {
      OR: [
        { invoiceNumber: { contains: query, mode: 'insensitive' } },
        { client: { name: { contains: query, mode: 'insensitive' } } },
      ],
    }),

  };

  //Gestion des dates : doit être fait avant le fetch pour calculer le vrai statut "OVERDUE"

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Réinitialiser l'heure pour une comparaison précise

  //Récupérer toutes les factures initialement pour calculer le statut "OVERDUE"
  //Puis filtrer en mémoire (car Prisma ne supporte pas les conditions complexes avec OR/AND sur le même champ)
  //Alternativement, on pourrait utiliser des vues SQL ou des fonctions stockées pour gérer cela côté DB
  //Mais pour la simplicité, on fait en mémoire ici
  const invoices = await prisma.invoice.findMany({
    where: whereClause, //Applique les filtres initiaux
    include: {
      client: true,
    },
    orderBy: {
      dueDate: 'asc',//
    },
  });

  /* const clients = await prisma.client.findMany({
    orderBy: {
      name: 'asc',
    },
  }); */
  
  //Parcours des factures pour déterminer le statut "OVERDUE" à la volée
  const invoicesWithComputedStatus = invoices.map(invoice => {
    let currentStatus = invoice.status;
    const invoiceDueDate = new Date(invoice.dueDate);
    // Comparaison des dates sans l'heure
    invoiceDueDate.setHours(0, 0, 0, 0);
    
    if (currentStatus === 'PENDING' && invoiceDueDate < today) {
      currentStatus = 'OVERDUE';
    }

    // Conversion des champs Decimal en number
    return {
      ...invoice,
      status: currentStatus,
      totalAmount: invoice.totalAmount?.toNumber?.() ?? 0,
      vatAmount: invoice.vatAmount?.toNumber?.() ?? 0,
      // Ajoutez ici d'autres conversions si besoin
    };
  });

  // Filtrage final par date si spécifié (appliqué sur les factures avec statut calculé)
  
  const filteredInvoicesByDate = invoicesWithComputedStatus.filter(invoice => {
    if (!dateField || (!startDate && !endDate)) {
      return true; // Pas de filtre de date
    }

    const dateToCompare = new Date(invoice[dateField]); // issueDate ou dueDate
    dateToCompare.setHours(0, 0, 0, 0);

    const start = startDate ? new Date(startDate) : null;
    if (start) start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : null;
    if (end) end.setHours(23, 59, 59, 999); // Fin de journée

    let isAfterStart = true;
    if (start && dateToCompare < start) {
      isAfterStart = false;
    }

    let isBeforeEnd = true;
    if (end && dateToCompare > end) {
      isBeforeEnd = false;
    }

    return isAfterStart && isBeforeEnd;
  });

  // Appliquer le filtre de statut "OVERDUE" si sélectionné (puisque c'est un statut calculé)
  const finalInvoices = filteredInvoicesByDate.filter(invoice => {
    if (status === 'OVERDUE' && invoice.status !== 'OVERDUE') {
      return false;
    }
    return true;
  });

  // On récupère les clients séparément (sans filtres sur les factures)
  const clientsList = await prisma.client.findMany({
    orderBy: {
      name: 'asc',
    },
  });

  return { clients: clientsList, invoices: finalInvoices };
}


// NOTE: Suppression côté server action retirée; utiliser DELETE /api/clients/[id].

// Nouvelle méthode pour mettre à jour le statut d'une facture
export async function updateInvoiceStatus(formData) {
  const invoiceId = formData.get('invoiceId');
  const newStatus = formData.get('newStatus');//'PAID', 'PENDING', 'OVERDUE'

  // Vérification si le statut est valide (contre les entrées inattendues)
  const validStatuses = ['PENDING', 'PAID', 'OVERDUE'];
  if (!validStatuses.includes(newStatus)) {
    return { error: `Statut invalide : ${newStatus}` };
  }

  try {
    await prisma.invoice.update({
      where: {
        id: invoiceId,
      },
      data: {
        status: newStatus, // Met à jour le statut avec la nouvelle valeur
      },
    });
    console.log(`Statut de la facture ${invoiceId} mis à jour à ${newStatus}.`);
    
    // Invalider le cache et re-rendre la page des factures
    revalidatePath('/invoices');
    // Pas de redirect car nous sommes déjà sur la page et revalidatePath suffit

    return { success: true };

  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut de la facture:', error);
    return { error: 'Erreur inattendue lors de la mise à jour du statut de la facture.' };
  }
}

// Nouvelle méthode pour récupérer une facture par son ID, avec le statut calculé
export async function fetchInvoiceById(id){
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: id },
      include: { 
        client: {
          select: {// Inclure uniquement les champs nécessaires
            id: true,
            name: true,
            email: true,
            address: true,
            category: true
          },
        },
        // Inclure les lignes de facture et leur compte pour génération PDF et analyses
        invoiceLines: {
          include: {
            account: { select: { number: true, label: true } }
          }
        }
       }, // Inclure les informations du client lié
    });
    if (!invoice) {
      console.warn(`Facture avec l'ID ${id} non trouvée.`);
      return null;// Retourne null si la facture n'existe pas
    }

    //---Détection du statut "OVERDUE" à la volée comme dans fetchClientAndInvoice---
    let currentStatus = invoice.status;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (currentStatus === 'PENDING' && new Date(invoice.dueDate) < today) {
      currentStatus = 'OVERDUE';
    }
    return { ...invoice, status: currentStatus, totalAmount: invoice.totalAmount?.toNumber?.() ?? 0, vatAmount: invoice.vatAmount?.toNumber?.() ?? 0 };// Retourne la facture avec le statut potentiellement mis à jour
  } catch (error) {
    console.error(`Erreur lors de la récupération de la facture par ID: ${id}`, error);

    throw new Error('Erreur inattendue lors de la récupération de la facture.');
  }
}

  