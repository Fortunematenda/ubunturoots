import { prisma } from './prisma';
import { toNumber } from './serialize';

export async function getDashboardSummary() {
  const [membersCount, activeFuneralCases, contributions, payments, recentNotifications] = await Promise.all([
    prisma.member.count(),
    prisma.funeralCase.count({ where: { isActive: true } }),
    prisma.contribution.findMany({
      select: {
        status: true,
        amount: true
      }
    }),
    prisma.payment.findMany({
      select: {
        amount: true
      }
    }),
    prisma.notification.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' }
    })
  ]);

  const paidMembers = contributions.filter((item: { status: string }) => item.status === 'PAID').length;
  const pendingMembers = contributions.filter((item: { status: string }) => item.status !== 'PAID').length;
  const totalContributions = contributions.reduce(
    (sum: number, item: { amount: unknown }) => sum + toNumber(item.amount),
    0
  );
  const collected = payments.reduce(
    (sum: number, item: { amount: unknown }) => sum + toNumber(item.amount),
    0
  );

  return {
    membersCount,
    activeFuneralCases,
    paidMembers,
    pendingMembers,
    totalContributions,
    collected,
    completionRate: contributions.length ? (paidMembers / contributions.length) * 100 : 0,
    recentNotifications
  };
}
