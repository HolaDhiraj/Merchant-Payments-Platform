// Roles. Platform staff run onboarding; merchant roles belong to exactly one merchant (tenant).
// Authorization decisions are made from these plus object ownership.
export enum Role {
  ADMIN = 'ADMIN',
  REVIEWER = 'REVIEWER',
  SALES = 'SALES',
  // The merchant's owner/administrator: everything in their own merchant portal.
  MERCHANT_ADMIN = 'MERCHANT_ADMIN',
  // Takes payments and manages customers.
  MERCHANT_SALES = 'MERCHANT_SALES',
  // Reviews payments held by fraud screening and reads reports.
  MERCHANT_REVIEWER = 'MERCHANT_REVIEWER',
}

export const PLATFORM_ROLES: readonly Role[] = [Role.ADMIN, Role.REVIEWER, Role.SALES];
export const MERCHANT_ROLES: readonly Role[] = [
  Role.MERCHANT_ADMIN,
  Role.MERCHANT_SALES,
  Role.MERCHANT_REVIEWER,
];

export function isMerchantRole(role: Role): boolean {
  return MERCHANT_ROLES.includes(role);
}
