import { prisma } from '@/lib/prisma';
import { RelationshipFinderForm } from '@/components/relationship-finder-form';

export default async function RelationshipFinderPage({
  searchParams
}: {
  searchParams?: {
    personA?: string;
    personB?: string;
  };
}) {
  const members = await prisma.member.findMany({
    select: {
      id: true,
      fullName: true
    },
    orderBy: { fullName: 'asc' }
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-ubuntu-green">Who am I related to?</h1>
      <p className="text-sm text-slate-600">Select two family members to detect relationship, cousin level, generation gap, and explanation path.</p>
      <RelationshipFinderForm
        members={members}
        initialPersonA={searchParams?.personA}
        initialPersonB={searchParams?.personB}
      />
    </div>
  );
}
