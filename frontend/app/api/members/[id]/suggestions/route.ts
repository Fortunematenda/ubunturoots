import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { fail, ok } from '@/lib/http';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: {
    id: string;
  };
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { response } = await requireAuth(request);
  if (response) {
    return response;
  }

  const memberId = context.params.id;
  if (!memberId) {
    return fail('Member id is required.', 400);
  }

  const type = request.nextUrl.searchParams.get('type') || 'siblings';
  if (type !== 'siblings') {
    return fail('Unsupported suggestion type.', 400);
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      fatherId: true,
      motherId: true
    }
  });

  if (!member) {
    return fail('Member not found', 404);
  }

  if (!member.fatherId && !member.motherId) {
    return ok([]);
  }

  const siblings = await prisma.member.findMany({
    where: {
      id: { not: memberId },
      OR: [
        member.fatherId ? { fatherId: member.fatherId } : undefined,
        member.motherId ? { motherId: member.motherId } : undefined
      ].filter(Boolean) as Array<{ fatherId?: string; motherId?: string }>
    },
    select: {
      id: true,
      fullName: true,
      phoneNumber: true,
      birthYear: true,
      location: true
    },
    orderBy: { fullName: 'asc' },
    take: 20
  });

  return ok(siblings);
}
