import { Role } from '@prisma/client';
import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { fail, ok } from '@/lib/http';
import { expenseCreateSchema } from '@/lib/validators';
import { prisma } from '@/lib/prisma';

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { auth, response } = await requireRole(request, [Role.SUPER_ADMIN, Role.TREASURER]);
  if (response || !auth) {
    return response ?? fail('Unauthorized', 401);
  }

  try {
    const body = await request.json();
    const parsed = expenseCreateSchema.safeParse(body);

    if (!parsed.success) {
      return fail('Invalid expense payload', 400, parsed.error.flatten());
    }

    const expense = await prisma.expense.create({
      data: {
        funeralCaseId: context.params.id,
        category: parsed.data.category,
        amount: parsed.data.amount,
        expenseDate: new Date(parsed.data.expenseDate),
        description: parsed.data.description,
        recordedByUserId: auth.userId
      }
    });

    return ok(expense, 201);
  } catch (error) {
    return fail('Failed to record expense', 500, error);
  }
}
