import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { currency, safeDate } from '@/lib/utils';
import { MemorialMessageForm } from '@/components/memorial-message-form';
import { MemberMemoriesForm } from '@/components/member-memories-form';
import { PhotoUploadForm } from '@/components/photo-upload-form';
import { FamilyConnectionManager } from '@/components/family-connection-manager';
import { RelationshipFinderForm } from '@/components/relationship-finder-form';

export default async function MemberProfilePage({
  params,
  searchParams
}: {
  params: {
    id: string;
  };
  searchParams?: {
    personA?: string;
  };
}) {
  const member = await prisma.member.findUnique({
    where: { id: params.id },
    include: {
      father: true,
      mother: true,
      spouse: true,
      childrenByFather: true,
      childrenByMother: true,
      contributions: {
        include: {
          funeralCase: true
        }
      },
      memories: {
        orderBy: { createdAt: 'desc' }
      },
      memorialMessages: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!member) {
    notFound();
  }

  const childrenMap = new Map([...member.childrenByFather, ...member.childrenByMother].map((child) => [child.id, child]));
  const children = Array.from(childrenMap.values());

  const siblings = await prisma.member.findMany({
    where: {
      id: { not: member.id },
      OR: [
        member.fatherId ? { fatherId: member.fatherId } : undefined,
        member.motherId ? { motherId: member.motherId } : undefined
      ].filter(Boolean) as Array<{ fatherId?: string; motherId?: string }>
    },
    orderBy: { fullName: 'asc' }
  });

  const latestContribution = member.contributions[0];
  const memberOptions = await prisma.member.findMany({
    select: {
      id: true,
      fullName: true
    },
    orderBy: { fullName: 'asc' }
  });

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-ubuntu-gray text-xl font-bold text-ubuntu-green">
              {member.fullName
                .split(' ')
                .slice(0, 2)
                .map((part) => part[0])
                .join('')}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ubuntu-green">{member.fullName}</h1>
              <p className="text-sm text-slate-600">
                {member.status === 'DECEASED' ? 'Memorial Profile' : 'Active Member'} • Joined {safeDate(member.dateJoined)}
              </p>
              <p className="text-sm text-slate-600">{member.location || 'Location not set'}</p>
            </div>
          </div>
          <Link href="/family-tree" className="btn-secondary">
            View Position in Family Tree
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="card p-5 space-y-2">
          <h2 className="text-lg font-bold text-ubuntu-green">Personal Details</h2>
          <p>Member ID: {member.memberCode}</p>
          <p>Phone: {member.phoneNumber || '-'}</p>
          <p>Gender: {member.gender}</p>
          <p>Birth Year: {member.birthYear || '-'}</p>
          <p>Clan Name: {member.clanName || '-'}</p>
          <p>Totem: {member.totem || '-'}</p>
          <p>Tribe: {member.tribe || '-'}</p>
          <p>Origin Country: {member.originCountry || '-'}</p>
          <p>Status: {member.status}</p>
          {member.deathDate ? <p>Death Date: {safeDate(member.deathDate)}</p> : null}
          <PhotoUploadForm memberId={member.id} />
        </article>

        <article className="card p-5 space-y-2">
          <h2 className="text-lg font-bold text-ubuntu-green">Relationships</h2>
          <div>
            <p className="font-semibold">Parents</p>
            <ul className="list-disc pl-6 text-sm text-slate-700">
              <li>{member.father?.fullName || 'Father not listed'}</li>
              <li>{member.mother?.fullName || 'Mother not listed'}</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">Spouse</p>
            <p className="text-sm text-slate-700">{member.spouse?.fullName || 'No spouse listed'}</p>
          </div>
          <div>
            <p className="font-semibold">Children</p>
            <ul className="list-disc pl-6 text-sm text-slate-700">
              {children.length ? children.map((child) => <li key={child.id}>{child.fullName}</li>) : <li>None listed</li>}
            </ul>
          </div>
          <div>
            <p className="font-semibold">Siblings</p>
            <ul className="list-disc pl-6 text-sm text-slate-700">
              {siblings.length ? siblings.map((sibling) => <li key={sibling.id}>{sibling.fullName}</li>) : <li>None listed</li>}
            </ul>
          </div>
        </article>
      </section>

      <FamilyConnectionManager memberId={member.id} />

      <RelationshipFinderForm members={memberOptions} fixedPersonBId={member.id} initialPersonA={searchParams?.personA} />

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card p-5">
          <h2 className="text-lg font-bold text-ubuntu-green">Family Memories</h2>
          <ul className="mt-3 space-y-3">
            {member.memories.length ? (
              member.memories.map((item) => (
                <li key={item.id} className="rounded-lg bg-slate-50 p-3">
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.type}</p>
                  {item.description ? <p className="mt-2 text-sm text-slate-600">{item.description}</p> : null}
                  <a className="mt-2 inline-block text-sm font-semibold text-ubuntu-green" href={item.fileUrl} target="_blank" rel="noreferrer">
                    Open file →
                  </a>
                </li>
              ))
            ) : (
              <li className="text-sm text-slate-500">No memories uploaded yet.</li>
            )}
          </ul>
        </article>

        <MemberMemoriesForm memberId={member.id} />
      </section>

      {latestContribution ? (
        <section className="card p-5">
          <h2 className="text-lg font-bold text-ubuntu-green">Latest Contribution Case</h2>
          <p className="text-sm text-slate-600">{latestContribution.funeralCase.funeralLocation}</p>
          <p className="font-semibold">Amount: {currency(latestContribution.amount.toString())}</p>
          <p>Status: {latestContribution.status}</p>
        </section>
      ) : null}

      {member.status === 'DECEASED' ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="card p-5">
            <h2 className="text-lg font-bold text-ubuntu-green">Family Tributes</h2>
            <ul className="mt-3 space-y-3">
              {member.memorialMessages.length ? (
                member.memorialMessages.map((item) => (
                  <li key={item.id} className="rounded-lg bg-slate-50 p-3">
                    <p className="font-semibold">{item.authorName}</p>
                    <p className="text-sm text-slate-600">{item.message}</p>
                  </li>
                ))
              ) : (
                <li className="text-sm text-slate-500">No messages yet.</li>
              )}
            </ul>
          </article>
          <MemorialMessageForm memberId={member.id} />
        </section>
      ) : null}
    </div>
  );
}
