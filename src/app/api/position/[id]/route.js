import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkPerm } from '@/lib/authz';
import { toPlain } from '@/lib/json';
import { getRequestRole } from '@/lib/requestAuth';
import { requireCompanyId } from '@/lib/tenant';

// GET: Get position by ID
export async function GET(request, { params }) {
  try {
    const companyId = requireCompanyId(request);
    const { id } = await params;
    const position = await prisma.position.findUnique({ where: { id, companyId }, include: { bareme: true } });
    if (!position) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(toPlain({ position }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Update position by ID
// PUT: Update position by ID
/* export async function PUT(request, { params }) {
  try {
    const { id } = await params; // ✅ Supprimez le await
    const data = await request.json();
    
    console.log('🟡 ID reçu:', id);
    console.log('🟡 Données reçues:', data);
    
    // Validation des données
    if (!id) {
      return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
    }
    
    if (!data || Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 });
    }
    
    const position = await prisma.position.update({
      where: { id: parseInt(id) }, // ✅ Conversion en number si nécessaire
      data: data
    });
    
    console.log('🟢 Position mise à jour:', position);
    return NextResponse.json(toPlain({ position }));
    
  } catch (error) {
    console.error('❌ Erreur PUT:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' }, 
      { status: 400 }
    );
  }
} */
export async function PUT(request, ctx) {
  try {
    const companyId = requireCompanyId(request);
    const role = await getRequestRole(request, { companyId });
    if (!checkPerm("manageEmployees", role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const body = await request.json();
    const data = {};
    if (typeof body.title === 'string') data.title = body.title;
    if (typeof body.description !== 'undefined') data.description = body.description;
    if (typeof body.baremeId !== 'undefined') data.baremeId = body.baremeId || null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Aucun champ valide à mettre à jour' }, { status: 400 });
    }

    const position = await prisma.position.update({ where: { id, companyId }, data, include: { bareme: true } });
    return NextResponse.json(toPlain({ position }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// DELETE: Delete position by ID
export async function DELETE(request, { params }) {
  try {
    const companyId = requireCompanyId(request);
    const role = await getRequestRole(request, { companyId });
    if (!checkPerm("manageEmployees", role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    await prisma.position.delete({ where: { id, companyId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
