import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { toPlain } from '@/lib/json';
import { nextSequence } from '@/lib/sequence';

// GET: List all employees
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const where = q
      ? {
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { employeeNumber: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};
    const employees = await prisma.employee.findMany({
      where,
      include: {
        position: true,
        history: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(toPlain({ employees }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create a new employee
export async function POST(request) {
  try {
    const data = await request.json();
    // Only allow fields defined in schema
    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      birthDate,
      hireDate,
      endDate,
      employeeNumber,
      gender,
      maritalStatus,
      childrenUnder18,
      socialSecurityNumber,
      status,
      positionId,
  contractType,
    } = data;

    // Basic enum validation for gender and marital status (UI should align with these values)
    const allowedGender = ['MALE','FEMALE'];
    const allowedMarital = ['SINGLE','MARRIED'];
    const allowedContractType = ['CDI','CDD','CI'];

    // Normalize optional foreign keys to avoid FK violations when UI sends '' / 'null'
    const normalizeId = (val) => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === 'string') {
        const v = val.trim();
        if (v === '' || v.toLowerCase() === 'null' || v.toLowerCase() === 'undefined') return undefined;
        return v;
      }
      return String(val);
    };
    const normalizedPositionId = normalizeId(positionId);
  // No contract entity anymore

    // Determine employee number if not provided, based on grouped Bareme categories
    // Snapshot category & choose group
    let snapshotCategory = undefined;
    let finalEmployeeNumber = (typeof employeeNumber === 'string' && employeeNumber.trim().length > 0)
      ? employeeNumber.trim()
      : undefined;
    let group = 'C';
    if (normalizedPositionId) {
      const pos = await prisma.position.findUnique({ where: { id: normalizedPositionId }, include: { bareme: true } });
      if (!pos) {
        return NextResponse.json({ error: 'Invalid positionId: not found' }, { status: 400 });
      }
      const cat = pos?.bareme?.category;
      const A_SET = ['A1','A2','A3','B1','B2','B3'];
      if (cat) {
        snapshotCategory = cat;
        if (A_SET.includes(cat)) group = 'A';
      }
    }
    // No contract entity anymore
    if (!finalEmployeeNumber) {
      finalEmployeeNumber = await nextSequence(prisma, `employeeNumber:${group}`, `${group}-`);
    }

    const employee = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        email,
        phone,
        address,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        hireDate: hireDate ? new Date(hireDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        employeeNumber: finalEmployeeNumber,
        gender: (typeof gender === 'string' && allowedGender.includes(gender)) ? gender : undefined,
        maritalStatus: (typeof maritalStatus === 'string' && allowedMarital.includes(maritalStatus)) ? maritalStatus : undefined,
        childrenUnder18: (typeof childrenUnder18 === 'number' && childrenUnder18 >= 0)
          ? Math.floor(childrenUnder18)
          : (typeof childrenUnder18 === 'string' && !isNaN(parseInt(childrenUnder18)) ? Math.max(0, parseInt(childrenUnder18)) : undefined),
        socialSecurityNumber: typeof socialSecurityNumber === 'string' && socialSecurityNumber.trim().length > 0 ? socialSecurityNumber.trim() : undefined,
        status: typeof status === 'string' ? status : undefined,
        positionId: normalizedPositionId,
        contractType: (typeof contractType === 'string' && allowedContractType.includes(contractType)) ? contractType : undefined,
        category: snapshotCategory,
      },
    });
    return NextResponse.json(toPlain({ employee }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
