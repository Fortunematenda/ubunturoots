import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { Role } from '@prisma/client';

export const AUTH_COOKIE = 'ubuntu_roots_auth';

export type AuthPayload = {
  userId: string;
  memberId?: string | null;
  role: Role;
  phoneNumber: string;
};

function getSecret() {
  return process.env.JWT_SECRET || 'ubuntu-roots-dev-secret';
}

export function signAuthToken(payload: AuthPayload) {
  return jwt.sign(payload, getSecret(), { expiresIn: '7d' });
}

export function verifyAuthToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, getSecret()) as AuthPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(token: string) {
  cookies().set({
    name: AUTH_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });
}

export function clearAuthCookie() {
  cookies().delete(AUTH_COOKIE);
}

export function getAuthFromRequest(request: NextRequest): AuthPayload | null {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (!token) {
    return null;
  }
  return verifyAuthToken(token);
}

export function requireRoles(auth: AuthPayload | null, roles: Role[]) {
  if (!auth || !roles.includes(auth.role)) {
    return false;
  }
  return true;
}
