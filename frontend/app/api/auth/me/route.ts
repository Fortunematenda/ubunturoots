import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { fail, ok } from '@/lib/http';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { auth, response } = await requireAuth(request);
  if (response || !auth) {
    return response ?? fail('Unauthorized', 401);
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { id: auth.userId },
        auth.phoneNumber ? { phoneNumber: auth.phoneNumber } : undefined
      ].filter(Boolean) as Array<{ id?: string; phoneNumber?: string }>
    },
    select: {
      id: true,
      fullName: true,
      phoneNumber: true,
      role: true,
      memberId: true
    }
  });

  if (!user) {
    return ok({
      id: auth.userId,
      fullName: auth.fullName,
      phoneNumber: auth.phoneNumber,
      role: auth.role,
      memberId: null
    });
  }

  return ok(user);
}
