import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { fail, ok } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { findRelationship } from '@/lib/relationship-engine';

type RouteContext = {
  params: {
    personA: string;
    personB: string;
  };
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { response } = await requireAuth(request);
  if (response) {
    return response;
  }

  const personA = context.params.personA;
  const personB = context.params.personB;

  if (!personA || !personB) {
    return fail('Both personA and personB are required.', 400);
  }

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

  const result = findRelationship(
    members.map((member) => ({
      id: member.id,
      fullName: member.fullName,
      gender: member.gender,
      fatherId: member.fatherId,
      motherId: member.motherId,
      spouseId: member.spouseId
    })),
    personA,
    personB
  );

  if (!result) {
    return fail('No relationship path found between selected members.', 404);
  }

  return ok(result);
}
