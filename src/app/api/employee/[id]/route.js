import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { toPlain } from '@/lib/json';

// GET: Get employee by ID
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        position: true,
        history: true,
      },
    });
  if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(toPlain({ employee }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Update employee by ID
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    // Allowlist updatable fields
    const data = {};
    if (typeof body.firstName === 'string') data.firstName = body.firstName;
    if (typeof body.lastName === 'string') data.lastName = body.lastName;
    if (typeof body.email !== 'undefined') data.email = body.email || null;
    if (typeof body.phone !== 'undefined') data.phone = body.phone || null;
    if (typeof body.address !== 'undefined') data.address = body.address || null;
    if (typeof body.gender !== 'undefined') {
      const allowed = ['MALE','FEMALE'];
      if (body.gender === null) {
        data.gender = null;
      } else if (typeof body.gender === 'string' && allowed.includes(body.gender)) {
        data.gender = body.gender;
      } else {
        return NextResponse.json({ error: `Genre invalide. Valeurs permises: ${allowed.join(', ')}` }, { status: 400 });
      }
    }
    if (typeof body.maritalStatus !== 'undefined') {
      const allowed = ['SINGLE','MARRIED'];
      if (body.maritalStatus === null) {
        data.maritalStatus = null;
      } else if (typeof body.maritalStatus === 'string' && allowed.includes(body.maritalStatus)) {
        data.maritalStatus = body.maritalStatus;
      } else {
        return NextResponse.json({ error: `État civil invalide. Valeurs permises: ${allowed.join(', ')}` }, { status: 400 });
      }
    }
    if (typeof body.childrenUnder18 !== 'undefined') {
      if (body.childrenUnder18 === null || body.childrenUnder18 === '') {
        data.childrenUnder18 = null;
      } else {
        const n = typeof body.childrenUnder18 === 'number' ? body.childrenUnder18 : parseInt(body.childrenUnder18);
        if (isNaN(n) || n < 0) {
          return NextResponse.json({ error: 'Nombre d\'enfants < 18 ans invalide' }, { status: 400 });
        }
        data.childrenUnder18 = Math.floor(n);
      }
    }
    if (typeof body.socialSecurityNumber !== 'undefined') {
      const v = (body.socialSecurityNumber ?? '').toString().trim();
      data.socialSecurityNumber = v.length > 0 ? v : null;
    }
    if (typeof body.employeeNumber !== 'undefined') {
      const num = (body.employeeNumber ?? '').toString().trim();
      data.employeeNumber = num.length > 0 ? num : null;
    }
    if (typeof body.status !== 'undefined') {
      const allowed = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'EXITED'];
      if (body.status === null) {
        // status is non-nullable in schema; reject explicit null
        return NextResponse.json({ error: 'Le statut ne peut pas être nul' }, { status: 400 });
      }
      if (typeof body.status === 'string' && allowed.includes(body.status)) {
        data.status = body.status;
      } else {
        return NextResponse.json({ error: `Statut invalide. Valeurs permises: ${allowed.join(', ')}` }, { status: 400 });
      }
    }
    if (typeof body.positionId !== 'undefined') {
      const normalizeId = (val) => {
        if (val === null || val === undefined) return null;
        if (typeof val === 'string') {
          const v = val.trim();
          if (v === '' || v.toLowerCase() === 'null' || v.toLowerCase() === 'undefined') return null;
          return v;
        }
        return String(val);
      };
      const normalizedPositionId = normalizeId(body.positionId);
      data.positionId = normalizedPositionId;
      // Recalc category snapshot if position changes
      if (normalizedPositionId) {
        const pos = await prisma.position.findUnique({ where: { id: normalizedPositionId }, include: { bareme: true } });
        if (!pos) {
          return NextResponse.json({ error: 'Invalid positionId: not found' }, { status: 400 });
        }
        data.category = pos?.bareme?.category || null;
        // Only assign employeeNumber automatically if currently missing and not provided explicitly in update
        if (typeof body.employeeNumber === 'undefined') {
          const current = await prisma.employee.findUnique({ where: { id } });
          if (!current?.employeeNumber) {
            const cat = pos?.bareme?.category;
            const A_SET = ['A1','A2','A3','B1','B2','B3'];
            let group = 'C';
            if (cat && A_SET.includes(cat)) group = 'A';
            // Lazy import nextSequence to avoid circular import patterns (already used elsewhere)
            const { nextSequence } = await import('@/lib/sequence');
            data.employeeNumber = await nextSequence(prisma, `employeeNumber:${group}`, `${group}-`);
          }
        }
      } else {
        data.category = null;
      }
    }
    if (typeof body.contractType !== 'undefined') {
      const allowed = ['CDI','CDD','CI'];
      if (body.contractType === null || body.contractType === '') {
        data.contractType = null;
      } else if (typeof body.contractType === 'string' && allowed.includes(body.contractType)) {
        data.contractType = body.contractType;
      } else {
        return NextResponse.json({ error: `Type de contrat invalide. Valeurs permises: ${allowed.join(', ')}` }, { status: 400 });
      }
    }
    // Contract model supprimé: ignorer contractId s'il est envoyé
    if (typeof body.birthDate !== 'undefined') data.birthDate = body.birthDate ? new Date(body.birthDate) : null;
    if (typeof body.hireDate !== 'undefined') data.hireDate = body.hireDate ? new Date(body.hireDate) : null;
    if (typeof body.endDate !== 'undefined') data.endDate = body.endDate ? new Date(body.endDate) : null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Aucun champ valide à mettre à jour' }, { status: 400 });
    }

    const employee = await prisma.employee.update({
      where: { id },
      data,
    });
    return NextResponse.json(toPlain({ employee }));
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

// DELETE: Delete employee by ID
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    await prisma.employee.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
