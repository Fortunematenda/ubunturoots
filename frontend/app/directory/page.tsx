import { prisma } from '@/lib/prisma';
import { MemberCard } from '@/components/member-card';
import { buildFamilyTree } from '@/lib/tree';

export default async function DirectoryPage({
  searchParams
}: {
  searchParams?: { query?: string; status?: 'ACTIVE' | 'DECEASED'; generation?: string };
}) {
  const query = searchParams?.query;
  const status = searchParams?.status;
  const generationFilter = searchParams?.generation ? Number(searchParams.generation) : undefined;

  const members = await prisma.member.findMany({
    where: {
      status: status || undefined,
      OR: query
        ? [
            { fullName: { contains: query, mode: 'insensitive' } },
            { location: { contains: query, mode: 'insensitive' } },
            { memberCode: { contains: query, mode: 'insensitive' } }
          ]
        : undefined
    },
    orderBy: { fullName: 'asc' }
  });

  const tree = buildFamilyTree(
    members.map((member) => ({
      id: member.id,
      fullName: member.fullName,
      photoUrl: member.photoUrl,
      fatherId: member.fatherId,
      motherId: member.motherId,
      spouseId: member.spouseId,
      birthYear: member.birthYear,
      status: member.status
    }))
  );

  const generationByMemberId = new Map(tree.nodes.map((node) => [node.id, node.generation]));
  const availableGenerations = Array.from(new Set(tree.nodes.map((node) => node.generation))).sort((a, b) => a - b);

  const visibleMembers = typeof generationFilter === 'number' && Number.isFinite(generationFilter)
    ? members.filter((member) => generationByMemberId.get(member.id) === generationFilter)
    : members;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-ubuntu-green">Member Directory</h1>
      <form className="card grid gap-3 p-4 md:grid-cols-3" method="get">
        <input className="input" name="query" placeholder="Search by name, location or member code" defaultValue={query} />
        <select className="input" name="status" defaultValue={status || ''}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DECEASED">Deceased</option>
        </select>
        <select className="input" name="generation" defaultValue={searchParams?.generation || ''}>
          <option value="">All generations</option>
          {availableGenerations.map((generation) => (
            <option key={generation} value={generation}>
              Generation {generation}
            </option>
          ))}
        </select>
        <button className="btn-primary md:col-span-3" type="submit">Search</button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {visibleMembers.map((member) => (
          <MemberCard key={member.id} member={{ ...member, generation: generationByMemberId.get(member.id) }} />
        ))}
      </div>
    </div>
  );
}
