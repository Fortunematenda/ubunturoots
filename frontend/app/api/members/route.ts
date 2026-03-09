import { MemberStatus, Role } from '@prisma/client';
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { fail, ok } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { memberCreateSchema } from '@/lib/validators';

export async function GET(request: NextRequest) {
  const { response } = await requireAuth(request);
  if (response) {
    return response;
  }

  const query = request.nextUrl.searchParams.get('query') || undefined;
  const status = request.nextUrl.searchParams.get('status') as MemberStatus | null;

  const members = await prisma.member.findMany({
    where: {
      status: status || undefined,
      OR: query
        ? [
            { fullName: { contains: query, mode: 'insensitive' } },
            { phoneNumber: { contains: query, mode: 'insensitive' } },
            { location: { contains: query, mode: 'insensitive' } },
            { memberCode: { contains: query, mode: 'insensitive' } }
          ]
        : undefined
    },
    orderBy: [{ fullName: 'asc' }]
  });

  return ok(members);
}

export async function POST(request: NextRequest) {
  const { auth, response } = await requireAuth(request);
  if (response || !auth) {
    return response ?? fail('Unauthorized', 401);
  }

  try {
    const body = await request.json();
    const parsed = memberCreateSchema.safeParse(body);

    if (!parsed.success) {
      return fail('Invalid member payload', 400, parsed.error.flatten());
    }

    const isSuperAdmin = auth.role === Role.SUPER_ADMIN;
    const existingMembersCount = await prisma.member.count();
    const isBootstrapCreation = existingMembersCount === 0;

    const currentUser = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        memberId: true
      }
    });

    const mappedUser =
      currentUser ||
      (auth.phoneNumber
        ? await prisma.user.findUnique({
            where: { phoneNumber: auth.phoneNumber },
            select: {
              id: true,
              fullName: true,
              phoneNumber: true,
              memberId: true
            }
          })
        : null);

    if (!isSuperAdmin) {
      if (!isBootstrapCreation) {
        return fail('Only administrators can create additional members.', 403);
      }

      if (mappedUser?.memberId) {
        return fail('Your profile is already linked to a member.', 409);
      }
    }

    const fallbackName = auth.fullName?.trim() || parsed.data.fullName;
    const fallbackPhone = auth.phoneNumber || parsed.data.phoneNumber || undefined;

    const createData = {
      memberCode: parsed.data.memberCode,
      fullName: isSuperAdmin ? parsed.data.fullName : mappedUser?.fullName || fallbackName,
      photoUrl: parsed.data.photoUrl || null,
      phoneNumber: isSuperAdmin ? parsed.data.phoneNumber : mappedUser?.phoneNumber || fallbackPhone,
      gender: parsed.data.gender,
      birthYear: parsed.data.birthYear,
      location: parsed.data.location,
      notes: parsed.data.notes,
      clanName: parsed.data.clanName,
      totem: parsed.data.totem,
      tribe: parsed.data.tribe,
      originCountry: parsed.data.originCountry,
      fatherId: parsed.data.fatherId,
      motherId: parsed.data.motherId,
      spouseId: parsed.data.spouseId,
      status: parsed.data.status
    };

    const member = isSuperAdmin
      ? await prisma.member.create({
          data: createData
        })
      : await prisma.$transaction(async (tx) => {
          const created = await tx.member.create({
            data: createData
          });

          if (mappedUser?.id) {
            await tx.user.update({
              where: { id: mappedUser.id },
              data: { memberId: created.id }
            });
          }

          return created;
        });

    return ok(member, 201);
  } catch (error) {
    return fail('Failed to create member', 500, error);
  }
}
