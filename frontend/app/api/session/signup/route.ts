import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { ok, fail } from '@/lib/http';

type SignupResponse = {
  success?: boolean;
  message?: string;
  token?: string;
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

function getNestedErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const errorValue = (payload as Record<string, unknown>).error;
  if (!errorValue || typeof errorValue !== 'object') return null;
  const messageValue = (errorValue as Record<string, unknown>).message;
  return typeof messageValue === 'string' ? messageValue : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const res = await fetch(`${resolveBackendBaseUrl()}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        firstName: body?.firstName,
        lastName: body?.lastName,
        surname: body?.surname,
        email: body?.email,
        password: body?.password
      }),
      cache: 'no-store'
    });

    const rawPayload: unknown = await res.json();
    const payload = rawPayload as SignupResponse;

    if (!res.ok) {
      const nestedMessage = getNestedErrorMessage(rawPayload);
      const message =
        typeof payload?.message === 'string' ? payload.message : typeof nestedMessage === 'string' ? nestedMessage : 'Signup failed';

      return fail(message, res.status, rawPayload);
    }

    if (!payload.token) {
      return fail('Signup failed: missing token', 500);
    }

    cookies().set({
      name: 'ubuntu_roots_auth',
      value: payload.token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });

    return ok({
      message: 'Account created',
      user: payload.user || null
    }, 201);
  } catch (error) {
    return fail('Failed to signup', 500, error);
  }
}
