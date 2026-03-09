"use client";

import Link from 'next/link';
import { FormEvent, useState } from 'react';

export function SignupForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function signup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const response = await fetch('/api/session/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, password })
    });
    const payload = await response.json();

    setLoading(false);

    if (!response.ok) {
      setMessage(payload?.error?.message || 'Signup failed');
      return;
    }

    setMessage('Account created. Redirecting...');
    window.location.href = '/';
  }

  return (
    <div className="card mx-auto w-full max-w-md p-6">
      <h1 className="text-2xl font-bold text-ubuntu-green">Create Account</h1>
      <p className="mt-2 text-sm text-slate-600">Create your account to access family dashboards.</p>

      <form className="mt-5 space-y-4" onSubmit={signup}>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">First name</span>
          <input
            className="input"
            placeholder="Nomusa"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Surname</span>
          <input
            className="input"
            placeholder="Moyo"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            required
          />
        </label>

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
            placeholder="Create a password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <button className="btn-primary w-full" disabled={loading} type="submit">
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-600">
        Already have an account?{' '}
        <Link className="font-semibold text-ubuntu-green underline" href="/login">
          Login here
        </Link>
      </p>

      {message ? <p className="mt-4 text-sm font-semibold text-slate-600">{message}</p> : null}
    </div>
  );
}
