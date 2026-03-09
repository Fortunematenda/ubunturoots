import Link from 'next/link';
import { safeDate } from '@/lib/utils';

type MemberCardProps = {
  member: {
    id: string;
    fullName: string;
    photoUrl: string | null;
    phoneNumber: string | null;
    location: string | null;
    birthYear: number | null;
    status: 'ACTIVE' | 'DECEASED';
    dateJoined: Date;
    generation?: number;
  };
};

export function MemberCard({ member }: MemberCardProps) {
  return (
    <article className="card flex items-start gap-4 p-4">
      {member.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={member.photoUrl} alt={member.fullName} className="h-16 w-16 rounded-full object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ubuntu-gray text-lg font-bold text-ubuntu-green">
          {member.fullName
            .split(' ')
            .slice(0, 2)
            .map((item) => item[0])
            .join('')}
        </div>
      )}
      <div className="flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold">{member.fullName}</p>
            <p className="text-sm text-slate-500">{member.location || 'Location not set'}</p>
          </div>
          <span
            className={`rounded-full px-2 py-1 text-xs font-bold ${
              member.status === 'ACTIVE'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {member.status}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-600">{member.phoneNumber || 'Phone not provided'}</p>
        <p className="text-sm text-slate-500">
          Birth year: {member.birthYear || '-'} • Joined: {safeDate(member.dateJoined)}
        </p>
        {typeof member.generation === 'number' ? <p className="text-sm text-slate-500">Generation: {member.generation}</p> : null}
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href={`/members/${member.id}`} className="inline-block text-sm font-semibold text-ubuntu-green">
            View profile →
          </Link>
          <Link href={`/relationship-finder?personB=${member.id}`} className="inline-block text-sm font-semibold text-slate-600 underline">
            Find relationship
          </Link>
        </div>
      </div>
    </article>
  );
}
