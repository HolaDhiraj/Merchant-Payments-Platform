import { AuditAction } from './audit-action.enum';

// An immutable record of who did what, to which entity, and when.
// Metadata is always redacted before it reaches this object.
export interface AuditEntry {
  readonly id: string;
  readonly actorId: string | null;
  readonly actorRole: string;
  readonly action: AuditAction;
  readonly entityType: string;
  readonly entityId: string;
  readonly metadata: Record<string, unknown>;
  readonly correlationId: string | null;
  readonly occurredAt: Date;
}
