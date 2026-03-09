import { Role } from '@prisma/client';
import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { fail, ok } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { buildGenerationLabels, clearRelationshipCache } from '@/lib/relationship-engine';

export async function POST(request: NextRequest) {
  const { response } = await requireRole(request, [Role.SUPER_ADMIN]);
  if (response) {
    return response;
  }

  try {
    const members = await prisma.member.findMany({
      select: {
        id: true,
        fullName: true,
        gender: true,
        fatherId: true,
        motherId: true,
        spouseId: true
      }
    });

    clearRelationshipCache();
    const generationLabels = buildGenerationLabels(
      members.map((member) => ({
        id: member.id,
        fullName: member.fullName,
        gender: member.gender,
        fatherId: member.fatherId,
        motherId: member.motherId,
        spouseId: member.spouseId
      }))
    );

    return ok({
      success: true,
      message: 'Relationship graph cache rebuilt successfully.',
      membersCount: members.length,
      generationLabels
    });
  } catch (error) {
    return fail('Failed to rebuild tree graph.', 500, error);
  }
}
