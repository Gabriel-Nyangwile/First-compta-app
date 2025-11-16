import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { toPlain } from '@/lib/json';

// GET: Get employee history record by ID
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const record = await prisma.employeeHistory.findUnique({
      where: { id },
      include: { employee: true },
    });
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(toPlain({ record }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Update employee history record by ID
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const data = {};
    if (typeof body.employeeId !== 'undefined') data.employeeId = body.employeeId;
    if (typeof body.changeType === 'string') data.changeType = body.changeType;
    if (typeof body.details !== 'undefined') data.details = body.details;
    if (typeof body.changeDate !== 'undefined') data.changeDate = body.changeDate ? new Date(body.changeDate) : null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Aucun champ valide à mettre à jour' }, { status: 400 });
    }

    const record = await prisma.employeeHistory.update({ where: { id }, data });
  return NextResponse.json(toPlain({ record }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// DELETE: Delete employee history record by ID
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    await prisma.employeeHistory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
