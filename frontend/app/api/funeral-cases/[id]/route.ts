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

  const funeralCase = await prisma.funeralCase.findUnique({
    where: { id: context.params.id },
    include: {
      deceasedMember: true,
      contributions: {
        include: {
          member: true
        }
      },
      payments: {
        include: {
          member: true
        },
        orderBy: {
          paymentDate: 'desc'
        }
      },
      expenses: {
        orderBy: {
          expenseDate: 'desc'
        }
      }
    }
  });

  if (!funeralCase) {
    return fail('Funeral case not found', 404);
  }

  return ok(funeralCase);
}
