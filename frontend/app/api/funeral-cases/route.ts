import { Role } from '@prisma/client';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/http';
import { funeralCreateSchema } from '@/lib/validators';
import { requireAuth, requireRole } from '@/lib/api-auth';
import { notifyAllMembers } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  const { response } = await requireAuth(request);
  if (response) {
    return response;
  }

  const funeralCases = await prisma.funeralCase.findMany({
    include: {
      deceasedMember: true,
      contributions: true,
      payments: true,
      expenses: true
    },
    orderBy: { funeralDate: 'desc' }
  });

  return ok(funeralCases);
}

export async function POST(request: NextRequest) {
  const { auth, response } = await requireRole(request, [Role.SUPER_ADMIN]);
  if (response || !auth) {
    return response ?? fail('Unauthorized', 401);
  }

  try {
    const body = await request.json();
    const parsed = funeralCreateSchema.safeParse(body);

    if (!parsed.success) {
      return fail('Invalid funeral case payload', 400, parsed.error.flatten());
    }

    const activeMembers = await prisma.member.findMany({ where: { status: 'ACTIVE' } });
    const expected = parsed.data.contributionPerMember * activeMembers.length;

    const funeralCase = await prisma.funeralCase.create({
      data: {
        deceasedMemberId: parsed.data.deceasedMemberId,
        photoUrl: parsed.data.photoUrl || null,
        dateOfDeath: new Date(parsed.data.dateOfDeath),
        funeralDate: new Date(parsed.data.funeralDate),
        funeralLocation: parsed.data.funeralLocation,
        familyMessage: parsed.data.familyMessage,
        contributionPerMember: parsed.data.contributionPerMember,
        totalExpectedContribution: expected,
        createdByUserId: auth.userId
      }
    });

    await prisma.member.update({
      where: { id: parsed.data.deceasedMemberId },
      data: {
        status: 'DECEASED',
        deathDate: new Date(parsed.data.dateOfDeath)
      }
    });

    if (activeMembers.length > 0) {
      await prisma.contribution.createMany({
        data: activeMembers.map((member) => ({
          funeralCaseId: funeralCase.id,
          memberId: member.id,
          amount: parsed.data.contributionPerMember,
          status: 'PENDING'
        }))
      });
    }

    await notifyAllMembers({
      funeralCaseId: funeralCase.id,
      title: 'Funeral Contribution Notice',
      message: `A new funeral case was created. Contribution amount is R${parsed.data.contributionPerMember}.`,
      channels: ['IN_APP']
    });

    return ok(funeralCase, 201);
  } catch (error) {
    return fail('Failed to create funeral case', 500, error);
  }
}
