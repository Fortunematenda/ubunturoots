import { NextRequest } from 'next/server';
import { Role } from '@prisma/client';
import { fail } from './http';

type BackendMeResponse = {
  success?: boolean;
  user?: {
    id: number;
    fullName: string;
    email: string;
    phoneNumber: string | null;
    role?: string;
  };
  message?: string;
};

function resolveBackendBaseUrl() {
  return process.env.BACKEND_API_BASE_URL || 'http://localhost:4000';
}

function parseRole(input: unknown): Role {
  if (input === Role.SUPER_ADMIN) return Role.SUPER_ADMIN;
  if (input === Role.TREASURER) return Role.TREASURER;
  return Role.MEMBER;
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get('authorization');
  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }
  const cookieToken = request.cookies.get('ubuntu_roots_auth')?.value;
  return cookieToken || null;
}

export type BackendAuth = {
  userId: string;
  role: Role;
  email: string;
  fullName: string;
  phoneNumber: string | null;
};

export async function requireBackendAuth(request: NextRequest): Promise<{ auth: BackendAuth | null; response: Response | null }> {
  const token = getBearerToken(request);
  if (!token) {
    return { auth: null, response: fail('Unauthorized', 401) };
  }

  try {
    const res = await fetch(`${resolveBackendBaseUrl()}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      return { auth: null, response: fail('Unauthorized', 401) };
    }

    const payload = (await res.json()) as BackendMeResponse;
    const user = payload.user;

    if (!user?.id || !user.email || !user.fullName) {
      return { auth: null, response: fail('Unauthorized', 401) };
    }

    return {
      auth: {
        userId: String(user.id),
        role: parseRole(user.role),
        email: user.email,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber
      },
      response: null
    };
  } catch (error) {
    return { auth: null, response: fail('Auth service unavailable', 503, error) };
  }
}

export async function requireBackendRole(
  request: NextRequest,
  allowedRoles: Role[]
): Promise<{ auth: BackendAuth | null; response: Response | null }> {
  const { auth, response } = await requireBackendAuth(request);
  if (response || !auth) {
    return { auth: null, response };
  }

  if (!allowedRoles.includes(auth.role)) {
    return { auth: null, response: fail('Forbidden', 403) };
  }

  return { auth, response: null };
}
