import { MemberStatus, RelationshipType } from '@prisma/client';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/api-auth';
import { fail, ok } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { findPotentialDuplicates, generateMemberCode } from '@/lib/member-directory';
import { clearRelationshipCache } from '@/lib/relationship-engine';

const relationshipSchema = z.object({
  relationshipType: z.enum(['spouse', 'child', 'sibling', 'parent', 'father', 'mother', 'brother', 'sister', 'son', 'daughter']),
  targetMemberId: z.string().optional(),
  forceCreate: z.boolean().optional(),
  member: z
    .object({
      fullName: z.string().min(2),
      phoneNumber: z.string().min(8).max(20).optional().or(z.literal('')),
      birthYear: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
      location: z.string().optional(),
      photoUrl: z.string().url().optional().or(z.literal('')),
      gender: z.string().optional()
    })
    .optional()
});

type RouteContext = {
  params: {
    id: string;
  };
};

type RelativeAction = z.infer<typeof relationshipSchema>['relationshipType'];
type CanonicalRelationship = 'spouse' | 'child' | 'parent' | 'sibling';

function normalizeGender(input?: string) {
  const value = (input || '').trim().toLowerCase();
  if (value.startsWith('f')) return 'Female';
  if (value.startsWith('m')) return 'Male';
  return 'Unknown';
}

function mapRelationship(action: RelativeAction): {
  canonicalType: CanonicalRelationship;
  impliedGender: 'Male' | 'Female' | null;
} {
  if (action === 'father') return { canonicalType: 'parent', impliedGender: 'Male' };
  if (action === 'mother') return { canonicalType: 'parent', impliedGender: 'Female' };
  if (action === 'son') return { canonicalType: 'child', impliedGender: 'Male' };
  if (action === 'daughter') return { canonicalType: 'child', impliedGender: 'Female' };
  if (action === 'brother') return { canonicalType: 'sibling', impliedGender: 'Male' };
  if (action === 'sister') return { canonicalType: 'sibling', impliedGender: 'Female' };
  return { canonicalType: action as CanonicalRelationship, impliedGender: null };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { response } = await requireAuth(request);
  if (response) {
    return response;
  }

  const sourceMember = await prisma.member.findUnique({
    where: { id: context.params.id },
    select: {
      id: true,
      fullName: true,
      gender: true,
      fatherId: true,
      motherId: true,
      spouseId: true
    }
  });

  if (!sourceMember) {
    return fail('Source member not found.', 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('Invalid JSON payload.', 400);
  }

  const parsed = relationshipSchema.safeParse(body);
  if (!parsed.success) {
    return fail('Invalid relationship payload.', 400, parsed.error.flatten());
  }

  const { relationshipType, targetMemberId, forceCreate, member } = parsed.data;
  const { canonicalType, impliedGender } = mapRelationship(relationshipType);

  if (!targetMemberId && !member) {
    return fail('Provide targetMemberId or member payload.', 400);
  }

  let targetId = targetMemberId;

  if (!targetId && member) {
    const duplicates = await findPotentialDuplicates(
      prisma,
      {
        fullName: member.fullName,
        phoneNumber: member.phoneNumber || undefined,
        birthYear: member.birthYear
      },
      sourceMember.id
    );

    if (duplicates.length && !forceCreate) {
      return fail('Possible duplicate member found. Link existing profile or retry with forceCreate=true.', 409, {
        duplicates
      });
    }

    const memberCode = await generateMemberCode(prisma);
    const created = await prisma.member.create({
      data: {
        memberCode,
        fullName: member.fullName.trim(),
        phoneNumber: member.phoneNumber || null,
        birthYear: member.birthYear,
        location: member.location || null,
        photoUrl: member.photoUrl || null,
        gender: impliedGender || normalizeGender(member.gender),
        status: MemberStatus.ACTIVE
      },
      select: {
        id: true
      }
    });

    targetId = created.id;
  }

  if (!targetId) {
    return fail('Could not resolve target member.', 400);
  }

  const targetMember = await prisma.member.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      fullName: true,
      gender: true,
      fatherId: true,
      motherId: true,
      spouseId: true
    }
  });

  if (!targetMember) {
    return fail('Target member not found.', 404);
  }

  await prisma.$transaction(async (tx) => {
    const ensure = async (sourceId: string, targetIdValue: string, type: RelationshipType) => {
      if (sourceId === targetIdValue) return;
      await tx.relationship.upsert({
        where: {
          sourceId_targetId_type: {
            sourceId,
            targetId: targetIdValue,
            type
          }
        },
        update: {},
        create: {
          sourceId,
          targetId: targetIdValue,
          type
        }
      });
    };

    if (canonicalType === 'spouse') {
      await tx.member.update({ where: { id: sourceMember.id }, data: { spouseId: targetMember.id } });
      await tx.member.update({ where: { id: targetMember.id }, data: { spouseId: sourceMember.id } });
      await ensure(sourceMember.id, targetMember.id, RelationshipType.SPOUSE);
      await ensure(targetMember.id, sourceMember.id, RelationshipType.SPOUSE);
      return;
    }

    if (canonicalType === 'child') {
      const targetUpdates: { fatherId?: string; motherId?: string } = {};
      const sourceIsFemale = sourceMember.gender.toLowerCase().startsWith('f');

      if (sourceIsFemale) {
        targetUpdates.motherId = sourceMember.id;
      } else {
        targetUpdates.fatherId = sourceMember.id;
      }

      if (sourceMember.spouseId) {
        if (sourceIsFemale) {
          targetUpdates.fatherId = targetUpdates.fatherId || sourceMember.spouseId;
        } else {
          targetUpdates.motherId = targetUpdates.motherId || sourceMember.spouseId;
        }
      }

      await tx.member.update({
        where: { id: targetMember.id },
        data: targetUpdates
      });

      await ensure(sourceMember.id, targetMember.id, RelationshipType.PARENT);
      await ensure(targetMember.id, sourceMember.id, RelationshipType.CHILD);

      if (sourceMember.spouseId) {
        await ensure(sourceMember.spouseId, targetMember.id, RelationshipType.PARENT);
        await ensure(targetMember.id, sourceMember.spouseId, RelationshipType.CHILD);
      }
      return;
    }

    if (canonicalType === 'parent') {
      const sourceUpdates: { fatherId?: string; motherId?: string } = {};
      const targetIsFemale =
        impliedGender === 'Female' || (impliedGender === null && targetMember.gender.toLowerCase().startsWith('f'));

      if (targetIsFemale) {
        sourceUpdates.motherId = sourceMember.motherId || targetMember.id;
      } else {
        sourceUpdates.fatherId = sourceMember.fatherId || targetMember.id;
      }

      await tx.member.update({
        where: { id: sourceMember.id },
        data: sourceUpdates
      });

      await ensure(targetMember.id, sourceMember.id, RelationshipType.PARENT);
      await ensure(sourceMember.id, targetMember.id, RelationshipType.CHILD);
      return;
    }

    if (canonicalType === 'sibling') {
      const sourceHasParents = Boolean(sourceMember.fatherId || sourceMember.motherId);
      const targetHasParents = Boolean(targetMember.fatherId || targetMember.motherId);

      if (sourceHasParents && !targetHasParents) {
        await tx.member.update({
          where: { id: targetMember.id },
          data: {
            fatherId: sourceMember.fatherId || undefined,
            motherId: sourceMember.motherId || undefined
          }
        });
      } else if (!sourceHasParents && targetHasParents) {
        await tx.member.update({
          where: { id: sourceMember.id },
          data: {
            fatherId: targetMember.fatherId || undefined,
            motherId: targetMember.motherId || undefined
          }
        });
      } else if (sourceHasParents && targetHasParents) {
        await tx.member.update({
          where: { id: targetMember.id },
          data: {
            fatherId: sourceMember.fatherId || targetMember.fatherId || undefined,
            motherId: sourceMember.motherId || targetMember.motherId || undefined
          }
        });
      }

      const sourceParentsAfterMerge = {
        fatherId: sourceMember.fatherId || targetMember.fatherId || null,
        motherId: sourceMember.motherId || targetMember.motherId || null
      };

      if (sourceParentsAfterMerge.fatherId) {
        await ensure(sourceParentsAfterMerge.fatherId, sourceMember.id, RelationshipType.PARENT);
        await ensure(sourceMember.id, sourceParentsAfterMerge.fatherId, RelationshipType.CHILD);
        await ensure(sourceParentsAfterMerge.fatherId, targetMember.id, RelationshipType.PARENT);
        await ensure(targetMember.id, sourceParentsAfterMerge.fatherId, RelationshipType.CHILD);
      }

      if (sourceParentsAfterMerge.motherId) {
        await ensure(sourceParentsAfterMerge.motherId, sourceMember.id, RelationshipType.PARENT);
        await ensure(sourceMember.id, sourceParentsAfterMerge.motherId, RelationshipType.CHILD);
        await ensure(sourceParentsAfterMerge.motherId, targetMember.id, RelationshipType.PARENT);
        await ensure(targetMember.id, sourceParentsAfterMerge.motherId, RelationshipType.CHILD);
      }
    }
  });

  clearRelationshipCache();

  const refreshed = await prisma.member.findUnique({
    where: { id: sourceMember.id },
    include: {
      father: true,
      mother: true,
      spouse: true,
      childrenByFather: true,
      childrenByMother: true
    }
  });

  return ok({
    relationshipType,
    canonicalType,
    targetMemberId: targetMember.id,
    sourceMember: refreshed
  });
}

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
      relationshipSource: {
        include: {
          target: true
        }
      }
    }
  });

  if (!member) {
    return fail('Member not found.', 404);
  }

  return ok(member);
}
