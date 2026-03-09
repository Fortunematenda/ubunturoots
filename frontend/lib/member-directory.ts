import type { Prisma, PrismaClient } from '@prisma/client';

type DbClient = PrismaClient | Prisma.TransactionClient;

type DuplicateSearchInput = {
  fullName?: string;
  phoneNumber?: string | null;
  birthYear?: number | null;
};

function normalizeName(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function findPotentialDuplicates(db: DbClient, input: DuplicateSearchInput, excludeMemberId?: string) {
  const name = input.fullName?.trim();
  const normalizedName = name ? normalizeName(name) : '';
  const phone = input.phoneNumber?.trim();
  const birthYear = input.birthYear ?? undefined;

  if (!name && !phone && !birthYear) {
    return [];
  }

  const conditions: Prisma.MemberWhereInput[] = [];

  if (name) {
    conditions.push({ fullName: { equals: name, mode: 'insensitive' } });
    conditions.push({ fullName: { contains: name, mode: 'insensitive' } });
  }

  if (phone) {
    conditions.push({ phoneNumber: phone });
  }

  if (birthYear) {
    conditions.push({ birthYear });
  }

  const matches = await db.member.findMany({
    where: {
      id: excludeMemberId ? { not: excludeMemberId } : undefined,
      OR: conditions
    },
    select: {
      id: true,
      fullName: true,
      phoneNumber: true,
      birthYear: true,
      location: true,
      photoUrl: true
    },
    orderBy: { fullName: 'asc' },
    take: 8
  });

  return matches
    .map((member) => {
      let score = 0;

      if (name) {
        const normalizedMemberName = normalizeName(member.fullName);
        if (normalizedMemberName === normalizedName) {
          score += 4;
        } else if (normalizedMemberName.includes(normalizedName) || normalizedName.includes(normalizedMemberName)) {
          score += 2;
        }
      }
      if (phone && member.phoneNumber && member.phoneNumber === phone) {
        score += 5;
      }
      if (birthYear && member.birthYear && member.birthYear === birthYear) {
        score += 2;
      }

      return {
        ...member,
        score
      };
    })
    .sort((a, b) => b.score - a.score);
}

export async function generateMemberCode(db: DbClient) {
  for (let index = 0; index < 8; index += 1) {
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    const code = `UBR-${randomPart}`;
    const existing = await db.member.findUnique({ where: { memberCode: code }, select: { id: true } });
    if (!existing) {
      return code;
    }
  }

  return `UBR-${Date.now().toString().slice(-6)}`;
}
