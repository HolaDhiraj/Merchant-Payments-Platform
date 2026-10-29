import { Role } from './role.enum';

// The authenticated caller of a use case. Use cases depend on this small value object
// rather than on HTTP request objects, so business rules stay transport-agnostic.
export interface Actor {
  readonly userId: string;
  readonly role: Role;
}

// Identifies background processes (e.g. the risk worker) in the audit trail.
export const SYSTEM_ACTOR_ROLE = 'SYSTEM';
