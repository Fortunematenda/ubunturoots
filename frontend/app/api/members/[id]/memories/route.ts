import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/api-auth';
import { fail, ok } from '@/lib/http';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: {
    id: string;
  };
};

const memorySchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(800).optional().or(z.literal('')),
  fileUrl: z.string().url(),
  type: z.enum(['PHOTO', 'AUDIO', 'VIDEO', 'DOCUMENT']),
  memberId: z.string().optional()
});

export async function GET(request: NextRequest, context: RouteContext) {
  const { response } = await requireAuth(request);
  if (response) {
    return response;
  }

  const memberId = context.params.id;
  if (!memberId) {
    return fail('Member id is required.', 400);
  }

  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!member) {
    return fail('Member not found', 404);
  }

  const memories = await prisma.familyMemory.findMany({
    where: {
      memberId
    },
    orderBy: { createdAt: 'desc' }
  });

  return ok(memories);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { auth, response } = await requireAuth(request);
  if (response || !auth) {
    return response ?? fail('Unauthorized', 401);
  }

  const memberId = context.params.id;
  if (!memberId) {
    return fail('Member id is required.', 400);
  }

  try {
    const body = await request.json();
    const parsed = memorySchema.safeParse({
      ...body,
      memberId
    });

    if (!parsed.success) {
      return fail('Invalid memory payload', 400, parsed.error.flatten());
    }

    const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true } });
    if (!member) {
      return fail('Member not found', 404);
    }

    const created = await prisma.familyMemory.create({
      data: {
        memberId,
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() || null,
        fileUrl: parsed.data.fileUrl.trim(),
        type: parsed.data.type,
        createdByUserId: auth.userId
      }
    });

    return ok(created, 201);
  } catch (error) {
    return fail('Failed to save memory', 500, error);
  }
}
