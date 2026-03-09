import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { currency, safeDate } from '@/lib/utils';

export default async function FuneralCasesPage() {
  const funeralCases = await prisma.funeralCase.findMany({
    include: {
      deceasedMember: true,
      contributions: true,
      payments: true,
      expenses: true
    },
    orderBy: { funeralDate: 'desc' }
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-ubuntu-green">Funeral Cases</h1>

      <div className="space-y-4">
        {funeralCases.map((item) => {
          const paidCount = item.contributions.filter((c) => c.status === 'PAID').length;
          const pendingCount = item.contributions.length - paidCount;
          return (
            <article key={item.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">{item.deceasedMember.fullName}</h2>
                  <p className="text-sm text-slate-600">
                    Death: {safeDate(item.dateOfDeath)} • Funeral: {safeDate(item.funeralDate)}
                  </p>
                  <p className="text-sm text-slate-600">Location: {item.funeralLocation}</p>
                </div>
                <Link href={`/funeral-cases/${item.id}`} className="btn-primary">
                  Open Case
                </Link>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3 text-sm">
                  <p className="font-semibold">Contribution / Member</p>
                  <p>{currency(item.contributionPerMember.toString())}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-sm">
                  <p className="font-semibold">Paid Members</p>
                  <p>{paidCount}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-sm">
                  <p className="font-semibold">Pending Members</p>
                  <p>{pendingCount}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
