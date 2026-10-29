import { Inject, Injectable } from '@nestjs/common';
import { Actor, SYSTEM_ACTOR_ROLE } from '../../../shared/domain/actor';
import { Clock, CLOCK } from '../../../shared/domain/clock';
import { IdGenerator, ID_GENERATOR } from '../../../shared/domain/id-generator';
import { redactSensitive } from '../../../shared/security/redaction';
import { RequestContext } from '../../../shared/infrastructure/request-context/request-context';
import { AuditAction } from '../domain/audit-action.enum';
import { AUDIT_LOG_REPOSITORY, AuditLogRepository } from '../domain/audit-log.repository';

export interface RecordAuditCommand {
  // null means the action was performed by the system (e.g. the risk worker).
  actor: Actor | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

// Application service used by every use case to write audit entries.
// It always redacts metadata, so callers cannot accidentally persist secrets.
// When called inside a UnitOfWork the entry commits or rolls back with the business change.
@Injectable()
export class AuditLogger {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY) private readonly repository: AuditLogRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async record(command: RecordAuditCommand): Promise<void> {
    await this.repository.append({
      id: this.ids.next(),
      actorId: command.actor?.userId ?? null,
      actorRole: command.actor?.role ?? SYSTEM_ACTOR_ROLE,
      action: command.action,
      entityType: command.entityType,
      entityId: command.entityId,
      metadata: redactSensitive(command.metadata ?? {}) as Record<string, unknown>,
      correlationId: RequestContext.correlationId() ?? null,
      occurredAt: this.clock.now(),
    });
  }
}
