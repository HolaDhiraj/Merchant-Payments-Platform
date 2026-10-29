import { Page, PageRequest } from '../../../shared/application/pagination';
import { AuditAction } from './audit-action.enum';
import { AuditEntry } from './audit-entry';

export interface AuditLogFilter {
  entityId?: string;
  action?: AuditAction;
}

// Append-only persistence port: there is intentionally no update or delete.
export interface AuditLogRepository {
  append(entry: AuditEntry): Promise<void>;
  search(filter: AuditLogFilter, page: PageRequest): Promise<Page<AuditEntry>>;
}

export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');
