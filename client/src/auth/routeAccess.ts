import { matchPath } from 'react-router-dom';
import type { Role } from '@/api/types';
import { MERCHANT_ROLES } from '@/lib/roles';

const PLATFORM: Role[] = ['ADMIN', 'REVIEWER', 'SALES'];

// Who may open each guarded screen. The router guards every route from this table, and the
// sign-in page uses it to decide whether to return to the page a session ended on: the next
// person to sign in may have a different role. The API enforces the same rules itself.
// More specific patterns come first ('applications/new' before 'applications/:id').
export const ROUTE_ROLES = {
  applications: PLATFORM,
  'applications/new': ['SALES', 'ADMIN'],
  'applications/:id': PLATFORM,
  'applications/:id/edit': PLATFORM,
  merchants: ['ADMIN'],
  'merchants/:merchantId/*': ['ADMIN'],
  audit: ['ADMIN'],
  team: ['ADMIN'],
  portal: ['MERCHANT_ADMIN', 'MERCHANT_REVIEWER'],
  'portal/checkout': ['MERCHANT_ADMIN', 'MERCHANT_SALES'],
  'portal/payments': MERCHANT_ROLES,
  'portal/payments/:id': MERCHANT_ROLES,
  'portal/customers': MERCHANT_ROLES,
  'portal/customers/:id': MERCHANT_ROLES,
  'portal/products': MERCHANT_ROLES,
  'portal/team': ['MERCHANT_ADMIN'],
  'portal/settings': MERCHANT_ROLES,
} satisfies Record<string, Role[]>;

export type GuardedRoute = keyof typeof ROUTE_ROLES;

// Whether a user with this role may open the location (path plus optional ?query).
// Screens missing from the table are open to everyone signed in.
export function canOpen(role: Role, location: string): boolean {
  const pathname = location.split(/[?#]/)[0];
  for (const [pattern, roles] of Object.entries(ROUTE_ROLES) as [string, Role[]][]) {
    if (matchPath(`/${pattern}`, pathname)) return roles.includes(role);
  }
  return true;
}
