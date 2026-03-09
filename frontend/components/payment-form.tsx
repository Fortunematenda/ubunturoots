"use client";

import { FormEvent, useState } from 'react';

type PaymentFormProps = {
  funeralCaseId: string;
  members: Array<{ id: string; fullName: string }>;
};

export function PaymentForm({ funeralCaseId, members }: PaymentFormProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const formData = new FormData(event.currentTarget);
    const payload = {
      memberId: String(formData.get('memberId')),
      amount: Number(formData.get('amount')),
      paymentDate: String(formData.get('paymentDate')),
      paymentMethod: String(formData.get('paymentMethod')),
      notes: String(formData.get('notes') || '')
    };

    const response = await fetch(`/api/funeral-cases/${funeralCaseId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage(result?.error?.message || 'Failed to record payment');
      return;
    }

    setMessage('Payment recorded successfully. Refreshing...');
    setTimeout(() => window.location.reload(), 600);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 p-4">
      <h3 className="text-lg font-bold text-ubuntu-green">Record Payment</h3>
      <select className="input" required name="memberId" defaultValue="">
        <option value="" disabled>
          Select member
        </option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.fullName}
          </option>
        ))}
      </select>
      <input className="input" type="number" min="1" step="0.01" name="amount" placeholder="Amount" required />
      <input className="input" type="date" name="paymentDate" required />
      <input className="input" type="text" name="paymentMethod" placeholder="Cash, EFT, Mobile Money" required />
      <input className="input" type="text" name="notes" placeholder="Optional notes" />
      <button className="btn-primary w-full" type="submit" disabled={loading}>
        {loading ? 'Saving...' : 'Save Payment'}
      </button>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </form>
  );
}
