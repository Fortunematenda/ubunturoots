import { cookies } from 'next/headers';
import { ok } from '@/lib/http';

export async function POST() {
  cookies().set({
    name: 'ubuntu_roots_auth',
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  });

  return ok({ message: 'Logged out' });
}
