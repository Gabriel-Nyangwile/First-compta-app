// app/clients/create/actions.js
'use server'; // Cette directive est en haut du fichier pour qu'elle s'applique à toutes les fonctions exportées

import prisma from '@/lib/prisma';
import { redirect } from 'next/navigation';

export async function createClient(formData) {
  const name = formData.get('name');
  const email = formData.get('email');
  const address = formData.get('address');

  // Vérification de l'existence du client par son email
  const existingClient = await prisma.client.findUnique({
    where: {
      email: email,
    },
  });

  if (existingClient) {
    return { error: 'Un client avec cet email existe déjà.' };
  }

  // Si le client n'existe pas, procède à la création
  try {
    await prisma.client.create({
      data: {
        name,
        email,
        address,
      },
    });
  } catch (error) {
    console.error('Erreur lors de la création du client:', error);
    return { error: 'Erreur inattendue lors de la création du client.' };
  }
  
  redirect('/clients');
}