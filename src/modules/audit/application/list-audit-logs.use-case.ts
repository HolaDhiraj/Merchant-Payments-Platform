import { Inject, Injectable } from '@nestjs/common';
import { Page, PageRequest } from '../../../shared/application/pagination';
import { AuditEntry } from '../domain/audit-entry';
import {
  AUDIT_LOG_REPOSITORY,
  AuditLogFilter,
  AuditLogRepository,
} from '../domain/audit-log.repository';

// Read side of the audit trail (ADMIN only, enforced at the controller).
@Injectable()
export class ListAuditLogsUseCase {
  constructor(@Inject(AUDIT_LOG_REPOSITORY) private readonly repository: AuditLogRepository) {}

  execute(filter: AuditLogFilter, page: PageRequest): Promise<Page<AuditEntry>> {
    return this.repository.search(filter, page);
  }
}
