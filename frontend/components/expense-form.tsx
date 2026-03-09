"use client";

import { FormEvent, useState } from 'react';

type ExpenseFormProps = {
  funeralCaseId: string;
};

export function ExpenseForm({ funeralCaseId }: ExpenseFormProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const formData = new FormData(event.currentTarget);
    const payload = {
      category: String(formData.get('category')),
      amount: Number(formData.get('amount')),
      expenseDate: String(formData.get('expenseDate')),
      description: String(formData.get('description') || '')
    };

    const response = await fetch(`/api/funeral-cases/${funeralCaseId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage(result?.error?.message || 'Failed to record expense');
      return;
    }

    setMessage('Expense recorded successfully. Refreshing...');
    setTimeout(() => window.location.reload(), 600);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 p-4">
      <h3 className="text-lg font-bold text-ubuntu-green">Record Expense</h3>
      <select className="input" required name="category" defaultValue="">
        <option value="" disabled>
          Select category
        </option>
        <option value="Coffin">Coffin</option>
        <option value="Transport">Transport</option>
        <option value="Food">Food</option>
        <option value="Burial">Burial</option>
        <option value="Other">Other</option>
      </select>
      <input className="input" type="number" min="1" step="0.01" name="amount" placeholder="Amount" required />
      <input className="input" type="date" name="expenseDate" required />
      <input className="input" type="text" name="description" placeholder="Description" />
      <button className="btn-primary w-full" type="submit" disabled={loading}>
        {loading ? 'Saving...' : 'Save Expense'}
      </button>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </form>
  );
}
