import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { fail, ok } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { findPotentialDuplicates } from '@/lib/member-directory';

export async function GET(request: NextRequest) {
  const { response } = await requireAuth(request);
  if (response) {
    return response;
  }

  const fullName = request.nextUrl.searchParams.get('fullName') || undefined;
  const phoneNumber = request.nextUrl.searchParams.get('phoneNumber') || undefined;
  const birthYearRaw = request.nextUrl.searchParams.get('birthYear');
  const excludeMemberId = request.nextUrl.searchParams.get('excludeMemberId') || undefined;
  const birthYear = birthYearRaw ? Number(birthYearRaw) : undefined;

  if (!fullName && !phoneNumber && !birthYear) {
    return fail('Provide fullName, phoneNumber or birthYear to search duplicates.', 400);
  }

  const matches = await findPotentialDuplicates(
    prisma,
    {
      fullName,
      phoneNumber,
      birthYear: Number.isFinite(birthYear) ? birthYear : undefined
    },
    excludeMemberId
  );

  return ok(matches);
}
