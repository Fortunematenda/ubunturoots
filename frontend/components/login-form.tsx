"use client";

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';

export function LoginForm() {
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const response = await fetch('/api/session/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const payload = await response.json();
    setLoading(false);

    if (!response.ok) {
      setMessage(payload?.error?.message || 'Sign in failed');
      return;
    }

    setMessage('Login successful. Redirecting...');
    window.location.href = nextUrl;
  }

  return (
    <div className="card mx-auto w-full max-w-md p-6">
      <h1 className="text-2xl font-bold text-ubuntu-green">Sign in</h1>
      <p className="mt-2 text-sm text-slate-600">Secure sign-in for family members.</p>
      <p className="mt-1 text-sm text-slate-600">
        New here?{' '}
        <Link className="font-semibold text-ubuntu-green underline" href="/signup">
          Create an account
        </Link>
      </p>

      <form className="mt-5 space-y-4" onSubmit={login}>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Email</span>
          <input
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Password</span>
          <input
            className="input"
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <button className="btn-primary w-full" disabled={loading} type="submit">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      {message ? <p className="mt-4 text-sm font-semibold text-slate-600">{message}</p> : null}
    </div>
  );
}
