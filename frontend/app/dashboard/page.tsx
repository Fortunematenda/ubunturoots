import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { currency } from '@/lib/utils';
import { StatCard } from '@/components/stat-card';
import { toNumber } from '@/lib/serialize';

export default async function DashboardPage() {
  const [membersCount, activeCases, contributions, payments, notifications] = await Promise.all([
    prisma.member.count(),
    prisma.funeralCase.count({ where: { isActive: true } }),
    prisma.contribution.findMany({ select: { status: true, amount: true } }),
    prisma.payment.findMany({ select: { amount: true } }),
    prisma.notification.findMany({ take: 6, orderBy: { createdAt: 'desc' } })
  ]);

  const paidMembers = contributions.filter((item) => item.status === 'PAID').length;
  const pendingMembers = contributions.length - paidMembers;
  const totalExpected = contributions.reduce((sum: number, item: { amount: unknown }) => sum + toNumber(item.amount), 0);
  const totalCollected = payments.reduce((sum: number, item: { amount: unknown }) => sum + toNumber(item.amount), 0);

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden p-6 md:p-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-ubuntu-gold">Ubuntu Roots Platform</p>
        <h1 className="mt-2 text-3xl font-bold text-ubuntu-green md:text-4xl">Our Family. Our Strength.</h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          A respectful and transparent family platform for member records, funeral contributions, and heritage preservation.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/directory" className="btn-primary">
            Open Member Directory
          </Link>
          <Link href="/family-tree" className="btn-secondary">
            View Family Tree
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Members" value={membersCount.toString()} />
        <StatCard label="Active Funeral Cases" value={activeCases.toString()} />
        <StatCard label="Total Contributions" value={currency(totalExpected)} />
        <StatCard label="Pending Payments" value={pendingMembers.toString()} helper={`${paidMembers} paid members`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card p-5">
          <h2 className="text-xl font-bold text-ubuntu-green">Contribution Progress</h2>
          <div className="mt-4 h-4 rounded-full bg-slate-200">
            <div
              className="h-4 rounded-full bg-ubuntu-gold"
              style={{ width: `${Math.min(100, totalExpected ? (totalCollected / totalExpected) * 100 : 0)}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Collected {currency(totalCollected)} of expected {currency(totalExpected)}
          </p>
        </article>

        <article className="card p-5">
          <h2 className="text-xl font-bold text-ubuntu-green">Recent Activity</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {notifications.map((notification: { id: string; title: string; message: string }) => (
              <li key={notification.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="font-semibold">{notification.title}</p>
                <p className="text-slate-600">{notification.message}</p>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
