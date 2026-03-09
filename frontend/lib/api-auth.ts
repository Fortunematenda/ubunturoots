import { NextRequest } from 'next/server';
import { Role } from '@prisma/client';
import { requireBackendAuth, requireBackendRole } from './backend-auth';
import { fail } from './http';

export async function requireAuth(request: NextRequest) {
  const { auth, response } = await requireBackendAuth(request);
  if (!auth || response) {
    return { auth: null, response: response ?? fail('Unauthorized', 401) };
  }
  return { auth, response: null };
}

export async function requireRole(request: NextRequest, allowedRoles: Role[]) {
  return requireBackendRole(request, allowedRoles);
}
