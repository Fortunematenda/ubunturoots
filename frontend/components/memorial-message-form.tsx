"use client";

import { FormEvent, useState } from 'react';

type MemorialMessageFormProps = {
  memberId: string;
};

export function MemorialMessageForm({ memberId }: MemorialMessageFormProps) {
  const [authorName, setAuthorName] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus('');

    const response = await fetch(`/api/members/${memberId}/memorial-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorName, message })
    });
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setStatus(payload?.error?.message || 'Could not submit condolence message');
      return;
    }

    setStatus('Message sent. Thank you for honoring your family member.');
    setAuthorName('');
    setMessage('');
    setTimeout(() => window.location.reload(), 700);
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 p-4">
      <h3 className="text-lg font-bold text-ubuntu-green">Leave a Condolence Message</h3>
      <input
        className="input"
        placeholder="Your name"
        value={authorName}
        onChange={(event) => setAuthorName(event.target.value)}
        required
      />
      <textarea
        className="input min-h-24"
        placeholder="Your message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        required
        maxLength={500}
      />
      <button className="btn-primary w-full" type="submit" disabled={loading}>
        {loading ? 'Sending...' : 'Post Message'}
      </button>
      {status ? <p className="text-sm text-slate-600">{status}</p> : null}
    </form>
  );
}
