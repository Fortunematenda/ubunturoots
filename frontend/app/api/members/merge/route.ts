import { Role } from '@prisma/client';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/api-auth';
import { fail, ok } from '@/lib/http';
import { prisma } from '@/lib/prisma';

const mergeSchema = z.object({
  sourceMemberId: z.string().min(1),
  targetMemberId: z.string().min(1)
});

export async function POST(request: NextRequest) {
  const { response } = await requireRole(request, [Role.SUPER_ADMIN]);
  if (response) {
    return response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('Invalid JSON payload.', 400);
  }

  const parsed = mergeSchema.safeParse(body);
  if (!parsed.success) {
    return fail('Invalid merge payload.', 400, parsed.error.flatten());
  }

  const { sourceMemberId, targetMemberId } = parsed.data;
  if (sourceMemberId === targetMemberId) {
    return fail('sourceMemberId and targetMemberId must be different.', 400);
  }

  const [source, target] = await Promise.all([
    prisma.member.findUnique({ where: { id: sourceMemberId } }),
    prisma.member.findUnique({ where: { id: targetMemberId } })
  ]);

  if (!source || !target) {
    return fail('Both source and target members must exist.', 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({ where: { memberId: sourceMemberId }, data: { memberId: targetMemberId } });

    await tx.member.updateMany({ where: { fatherId: sourceMemberId }, data: { fatherId: targetMemberId } });
    await tx.member.updateMany({ where: { motherId: sourceMemberId }, data: { motherId: targetMemberId } });
    await tx.member.updateMany({ where: { spouseId: sourceMemberId }, data: { spouseId: targetMemberId } });

    await tx.relationship.updateMany({ where: { sourceId: sourceMemberId }, data: { sourceId: targetMemberId } });
    await tx.relationship.updateMany({ where: { targetId: sourceMemberId }, data: { targetId: targetMemberId } });

    await tx.contribution.updateMany({ where: { memberId: sourceMemberId }, data: { memberId: targetMemberId } });
    await tx.payment.updateMany({ where: { memberId: sourceMemberId }, data: { memberId: targetMemberId } });
    await tx.memorialMessage.updateMany({ where: { memberId: sourceMemberId }, data: { memberId: targetMemberId } });

    await tx.member.delete({ where: { id: sourceMemberId } });
  });

  return ok({
    mergedInto: targetMemberId,
    removed: sourceMemberId
  });
}
