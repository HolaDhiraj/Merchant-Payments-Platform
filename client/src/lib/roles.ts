import type { MerchantRole, Role } from '@/api/types';

export const MERCHANT_ROLES: MerchantRole[] = ['MERCHANT_ADMIN', 'MERCHANT_SALES', 'MERCHANT_REVIEWER'];

export function isMerchantRole(role: Role): role is MerchantRole {
  return (MERCHANT_ROLES as Role[]).includes(role);
}

// Where each role lands after signing in.
export function homePathFor(role: Role): string {
  switch (role) {
    case 'MERCHANT_SALES':
      return '/portal/checkout';
    case 'MERCHANT_ADMIN':
    case 'MERCHANT_REVIEWER':
      return '/portal';
    default:
      return '/applications';
  }
}
