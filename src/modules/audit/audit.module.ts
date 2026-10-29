import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AUDIT_LOG_REPOSITORY } from './domain/audit-log.repository';
import { AuditLogOrmEntity } from './infrastructure/audit-log.orm-entity';
import { TypeOrmAuditLogRepository } from './infrastructure/typeorm-audit-log.repository';
import { AuditLogger } from './application/audit-logger';
import { ListAuditLogsUseCase } from './application/list-audit-logs.use-case';
import { AuditLogsController } from './presentation/audit-logs.controller';

// Audit trail. Swapping PostgreSQL for MongoDB only requires a new AUDIT_LOG_REPOSITORY adapter.
@Module({
  imports: [TypeOrmModule.forFeature([AuditLogOrmEntity])],
  controllers: [AuditLogsController],
  providers: [
    { provide: AUDIT_LOG_REPOSITORY, useClass: TypeOrmAuditLogRepository },
    AuditLogger,
    ListAuditLogsUseCase,
  ],
  exports: [AuditLogger],
})
export class AuditModule {}
