import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { currency, safeDate } from '@/lib/utils';
import { toNumber } from '@/lib/serialize';
import { PaymentForm } from '@/components/payment-form';
import { ExpenseForm } from '@/components/expense-form';

export default async function FuneralCaseDetailPage({
  params
}: {
  params: {
    id: string;
  };
}) {
  const funeralCase = await prisma.funeralCase.findUnique({
    where: { id: params.id },
    include: {
      deceasedMember: true,
      contributions: {
        include: { member: true }
      },
      payments: {
        include: { member: true },
        orderBy: { paymentDate: 'desc' }
      },
      expenses: {
        orderBy: { expenseDate: 'desc' }
      }
    }
  });

  if (!funeralCase) {
    notFound();
  }

  const totalExpected = toNumber(funeralCase.totalExpectedContribution);
  const totalCollected = funeralCase.payments.reduce((sum, item) => sum + toNumber(item.amount), 0);
  const totalExpenses = funeralCase.expenses.reduce((sum, item) => sum + toNumber(item.amount), 0);
  const balance = totalCollected - totalExpenses;
  const pendingMembers = funeralCase.contributions.filter((item) => item.status !== 'PAID').length;

  return (
    <div className="space-y-5">
      <section className="card p-5">
        <h1 className="text-2xl font-bold text-ubuntu-green">{funeralCase.deceasedMember.fullName}</h1>
        <p className="text-sm text-slate-600">
          Date of Death: {safeDate(funeralCase.dateOfDeath)} • Funeral Date: {safeDate(funeralCase.funeralDate)}
        </p>
        <p className="text-sm text-slate-600">Location: {funeralCase.funeralLocation}</p>
        <p className="mt-2 text-sm">{funeralCase.familyMessage || 'No family message added yet.'}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="card p-4">
          <p className="text-sm text-slate-500">Total Expected</p>
          <p className="text-xl font-bold">{currency(totalExpected)}</p>
        </article>
        <article className="card p-4">
          <p className="text-sm text-slate-500">Total Collected</p>
          <p className="text-xl font-bold">{currency(totalCollected)}</p>
        </article>
        <article className="card p-4">
          <p className="text-sm text-slate-500">Total Expenses</p>
          <p className="text-xl font-bold">{currency(totalExpenses)}</p>
        </article>
        <article className="card p-4">
          <p className="text-sm text-slate-500">Remaining Balance</p>
          <p className="text-xl font-bold">{currency(balance)}</p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <PaymentForm
          funeralCaseId={funeralCase.id}
          members={funeralCase.contributions.map((item) => ({ id: item.member.id, fullName: item.member.fullName }))}
        />
        <ExpenseForm funeralCaseId={funeralCase.id} />
      </section>

      <section className="card p-5">
        <h2 className="text-xl font-bold text-ubuntu-green">Contribution Status ({pendingMembers} pending)</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Member</th>
                <th className="py-2 pr-3">Amount</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {funeralCase.contributions.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2 pr-3">{item.member.fullName}</td>
                  <td className="py-2 pr-3">{currency(item.amount.toString())}</td>
                  <td className="py-2 pr-3">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="card p-5">
          <h2 className="text-lg font-bold text-ubuntu-green">Payments</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {funeralCase.payments.map((item) => (
              <li key={item.id} className="rounded-lg bg-slate-50 p-3">
                {item.member.fullName} paid {currency(item.amount.toString())} via {item.paymentMethod} on{' '}
                {safeDate(item.paymentDate)}
              </li>
            ))}
          </ul>
        </article>

        <article className="card p-5">
          <h2 className="text-lg font-bold text-ubuntu-green">Expenses</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {funeralCase.expenses.map((item) => (
              <li key={item.id} className="rounded-lg bg-slate-50 p-3">
                {item.category}: {currency(item.amount.toString())} on {safeDate(item.expenseDate)}
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
