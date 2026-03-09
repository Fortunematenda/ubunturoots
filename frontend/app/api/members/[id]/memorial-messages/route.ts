import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fail, ok } from '@/lib/http';
import { memorialMessageSchema } from '@/lib/validators';

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const body = await request.json();
    const parsed = memorialMessageSchema.safeParse(body);

    if (!parsed.success) {
      return fail('Invalid condolence message', 400, parsed.error.flatten());
    }

    const member = await prisma.member.findUnique({ where: { id: context.params.id } });
    if (!member) {
      return fail('Member not found', 404);
    }

    if (member.status !== 'DECEASED') {
      return fail('Condolence messages are only for memorial profiles', 400);
    }

    const message = await prisma.memorialMessage.create({
      data: {
        memberId: context.params.id,
        authorName: parsed.data.authorName,
        message: parsed.data.message
      }
    });

    return ok(message, 201);
  } catch (error) {
    return fail('Failed to save message', 500, error);
  }
}
