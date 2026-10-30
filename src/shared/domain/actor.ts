import { Role } from './role.enum';

// The authenticated caller of a use case. Use cases depend on this small value object
// rather than on HTTP request objects, so business rules stay transport-agnostic.
export interface Actor {
  readonly userId: string;
  readonly role: Role;
  // Set for merchant users only: the tenant every merchant-portal query is scoped to.
  readonly merchantId?: string | null;
}

// Identifies background processes (e.g. the risk worker) in the audit trail.
export const SYSTEM_ACTOR_ROLE = 'SYSTEM';
