import { Role } from '@prisma/client';
import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { fail, ok } from '@/lib/http';
import { paymentCreateSchema } from '@/lib/validators';
import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/serialize';

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
    const parsed = paymentCreateSchema.safeParse(body);

    if (!parsed.success) {
      return fail('Invalid payment payload', 400, parsed.error.flatten());
    }

    const payment = await prisma.payment.create({
      data: {
        funeralCaseId: context.params.id,
        memberId: parsed.data.memberId,
        amount: parsed.data.amount,
        paymentDate: new Date(parsed.data.paymentDate),
        paymentMethod: parsed.data.paymentMethod,
        notes: parsed.data.notes,
        createdByUserId: auth.userId
      }
    });

    const contribution = await prisma.contribution.findUnique({
      where: {
        funeralCaseId_memberId: {
          funeralCaseId: context.params.id,
          memberId: parsed.data.memberId
        }
      }
    });

    if (contribution) {
      const status =
        parsed.data.amount >= toNumber(contribution.amount)
          ? 'PAID'
          : parsed.data.amount > 0
            ? 'PARTIAL'
            : 'PENDING';

      await prisma.contribution.update({
        where: {
          funeralCaseId_memberId: {
            funeralCaseId: context.params.id,
            memberId: parsed.data.memberId
          }
        },
        data: { status }
      });
    }

    return ok(payment, 201);
  } catch (error) {
    return fail('Failed to record payment', 500, error);
  }
}
