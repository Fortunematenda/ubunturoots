import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE } from '@/lib/auth';

type BackendMeResponse = {
  success?: boolean;
  user?: {
    id: number;
    fullName: string;
    email: string;
    phoneNumber: string | null;
    role?: string;
  };
};

function resolveBackendBaseUrl() {
  return process.env.BACKEND_API_BASE_URL || 'http://localhost:4000';
}

export default async function ProfilePage() {
  const token = cookies().get(AUTH_COOKIE)?.value;

  if (!token) {
    redirect('/login?next=/profile');
  }

  let me: BackendMeResponse['user'] | null = null;
  let backendError = '';

  try {
    const res = await fetch(`${resolveBackendBaseUrl()}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      backendError = res.status === 401 ? 'Your session expired. Please sign in again.' : 'Unable to load profile from backend.';
    } else {
      const payload = (await res.json()) as BackendMeResponse;
      me = payload.user || null;
      if (!me?.id) {
        backendError = 'Profile data is incomplete. Please try again.';
      }
    }
  } catch {
    backendError = `Could not connect to backend (${resolveBackendBaseUrl()}).`;
  }

  if (!me?.id) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold text-ubuntu-green">My Profile</h1>
        <article className="card space-y-3 p-5">
          <p className="text-sm font-semibold text-rose-700">{backendError || 'Unable to load your profile right now.'}</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className="btn-secondary">
              Back to Dashboard
            </Link>
            <Link href="/login?next=/profile" className="btn-primary">
              Sign in again
            </Link>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-ubuntu-green">My Profile</h1>
      <article className="card p-5">
        <p className="text-sm text-slate-500">Full Name</p>
        <p className="text-lg font-semibold">{me.fullName}</p>

        <p className="mt-4 text-sm text-slate-500">Email</p>
        <p className="text-lg font-semibold">{me.email}</p>

        <p className="mt-4 text-sm text-slate-500">Phone Number</p>
        <p className="text-lg font-semibold">{me.phoneNumber || 'Not set'}</p>

        <p className="mt-4 text-sm text-slate-500">Role</p>
        <p className="text-lg font-semibold">{(me.role || 'MEMBER').replace('_', ' ')}</p>
      </article>
    </section>
  );
}
