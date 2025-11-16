import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { toPlain } from '@/lib/json';

// GET: List all employee history records
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const where = employeeId ? { employeeId } : {};
    const history = await prisma.employeeHistory.findMany({
      where,
      orderBy: { changeDate: 'desc' },
      include: { employee: true },
    });
  return NextResponse.json(toPlain({ history }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new employee history record
export async function POST(request) {
  try {
    const data = await request.json();
    const { employeeId, changeType, details, changeDate } = data;
    const allowedTypes = ['PROMOTION','MUTATION','SANCTION','SUSPENSION','END_CONTRACT'];
    if (!employeeId) {
      return NextResponse.json({ error: 'Employé requis' }, { status: 400 });
    }
    if (!changeType || !allowedTypes.includes(changeType)) {
      return NextResponse.json({ error: `Type de changement invalide. Valeurs permises: ${allowedTypes.join(', ')}` }, { status: 400 });
    }
    const record = await prisma.employeeHistory.create({
      data: {
        employeeId,
        changeType,
        details,
        changeDate: changeDate ? new Date(changeDate) : undefined,
      },
    });
  return NextResponse.json(toPlain({ record }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
