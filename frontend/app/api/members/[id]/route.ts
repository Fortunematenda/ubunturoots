import { Role } from '@prisma/client';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/http';
import { memberCreateSchema } from '@/lib/validators';
import { requireAuth, requireRole } from '@/lib/api-auth';

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

  const member = await prisma.member.findUnique({
    where: { id: context.params.id },
    include: {
      father: true,
      mother: true,
      spouse: true,
      childrenByFather: true,
      childrenByMother: true,
      contributions: {
        include: { funeralCase: true }
      },
      memorialMessages: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!member) {
    return fail('Member not found', 404);
  }

  return ok(member);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { response } = await requireRole(request, [Role.SUPER_ADMIN]);
  if (response) {
    return response;
  }

  try {
    const body = await request.json();
    const parsed = memberCreateSchema.partial().safeParse(body);
    if (!parsed.success) {
      return fail('Invalid member payload', 400, parsed.error.flatten());
    }

    const updated = await prisma.member.update({
      where: { id: context.params.id },
      data: {
        ...parsed.data,
        photoUrl: parsed.data.photoUrl || undefined
      }
    });

    return ok(updated);
  } catch (error) {
    return fail('Failed to update member', 500, error);
  }
}
