import { Role } from '@prisma/client';

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  SUPER_ADMIN: [
    'family.create',
    'members.create',
    'members.edit',
    'relationships.manage',
    'funerals.manage',
    'finances.manage',
    'payments.record',
    'expenses.record',
    'reports.view'
  ],
  TREASURER: ['payments.record', 'expenses.record', 'reports.view', 'funerals.view'],
  MEMBER: ['tree.view', 'members.view', 'funeral-notices.view', 'payments.view', 'payments.self']
};

export function can(role: Role, permission: string) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
