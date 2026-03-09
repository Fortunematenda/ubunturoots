import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/api-auth';
import { ok } from '@/lib/http';
import { buildFamilyTree } from '@/lib/tree';

export async function GET(request: NextRequest) {
  const { response } = await requireAuth(request);
  if (response) {
    return response;
  }

  const lazy = request.nextUrl.searchParams.get('lazy') === '1';
  const cursor = request.nextUrl.searchParams.get('cursor') || undefined;
  const limitParam = Number(request.nextUrl.searchParams.get('limit') || '120');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 20), 200) : 120;

  if (lazy) {
    const rows = await prisma.member.findMany({
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1
          }
        : {}),
      take: limit + 1,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
        phoneNumber: true,
        location: true,
        gender: true,
        clanName: true,
        totem: true,
        tribe: true,
        originCountry: true,
        fatherId: true,
        motherId: true,
        spouseId: true,
        birthYear: true,
        status: true
      }
    });

    const hasMore = rows.length > limit;
    const members = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? members[members.length - 1]?.id || null : null;

    return ok({
      members,
      hasMore,
      nextCursor,
      loadedCount: members.length
    });
  }

  const members = await prisma.member.findMany({
    orderBy: [{ birthYear: 'asc' }, { fullName: 'asc' }],
    select: {
      id: true,
      fullName: true,
      photoUrl: true,
      fatherId: true,
      motherId: true,
      spouseId: true,
      clanName: true,
      totem: true,
      tribe: true,
      originCountry: true,
      birthYear: true,
      status: true
    }
  });

  const tree = buildFamilyTree(members);
  return ok(tree);
}
