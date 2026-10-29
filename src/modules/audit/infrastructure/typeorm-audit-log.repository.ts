import { Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { TransactionalEntityManager } from '../../../shared/infrastructure/database/transactional-entity-manager';
import { buildPage, Page, PageRequest } from '../../../shared/application/pagination';
import { AuditEntry } from '../domain/audit-entry';
import { AuditLogFilter, AuditLogRepository } from '../domain/audit-log.repository';
import { AuditLogOrmEntity } from './audit-log.orm-entity';

// PostgreSQL-backed audit store. The table is append-only by convention here; in production
// the application DB role should additionally be denied UPDATE/DELETE on it.
@Injectable()
export class TypeOrmAuditLogRepository implements AuditLogRepository {
  constructor(private readonly entityManager: TransactionalEntityManager) {}

  async append(entry: AuditEntry): Promise<void> {
    // The cast is needed only because TypeORM's deep-partial type does not model free-form jsonb.
    const row = { ...entry } as QueryDeepPartialEntity<AuditLogOrmEntity>;
    await this.entityManager.current().getRepository(AuditLogOrmEntity).insert(row);
  }

  async search(filter: AuditLogFilter, page: PageRequest): Promise<Page<AuditEntry>> {
    const where: FindOptionsWhere<AuditLogOrmEntity> = {};
    if (filter.entityId) where.entityId = filter.entityId;
    if (filter.action) where.action = filter.action;

    const [rows, total] = await this.entityManager
      .current()
      .getRepository(AuditLogOrmEntity)
      .findAndCount({
        where,
        order: { occurredAt: 'DESC' },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      });
    return buildPage(rows, total, page);
  }
}
