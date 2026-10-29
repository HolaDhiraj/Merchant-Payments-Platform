import { DataSourceOptions } from 'typeorm';
import { UserOrmEntity } from '../../modules/users/infrastructure/user.orm-entity';
import { AuditLogOrmEntity } from '../../modules/audit/infrastructure/audit-log.orm-entity';
import { MerchantApplicationOrmEntity } from '../../modules/merchant-applications/infrastructure/persistence/merchant-application.orm-entity';
import { RiskAssessmentOrmEntity } from '../../modules/merchant-applications/infrastructure/persistence/risk-assessment.orm-entity';
import { InitialSchema1730000000000 } from './migrations/1730000000000-InitialSchema';
import { OutboxAndWebhookInbox1730000000001 } from './migrations/1730000000001-OutboxAndWebhookInbox';
import { OutboxMessageOrmEntity } from '../../shared/infrastructure/outbox/outbox-message.orm-entity';
import { ProcessedWebhookEventOrmEntity } from '../../modules/merchant-applications/infrastructure/webhooks/processed-webhook-event.orm-entity';

export interface DatabaseConnectionSettings {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  ssl: boolean;
}

// Single source of truth for TypeORM options, shared by the Nest app and the migration CLI.
// synchronize is always false: the schema only changes through reviewed migrations.
export function buildTypeOrmOptions(settings: DatabaseConnectionSettings): DataSourceOptions {
  return {
    type: 'postgres',
    host: settings.host,
    port: settings.port,
    database: settings.name,
    username: settings.user,
    password: settings.password,
    ssl: settings.ssl ? { rejectUnauthorized: true } : false,
    entities: [
      UserOrmEntity,
      AuditLogOrmEntity,
      MerchantApplicationOrmEntity,
      RiskAssessmentOrmEntity,
      OutboxMessageOrmEntity,
      ProcessedWebhookEventOrmEntity,
    ],
    migrations: [InitialSchema1730000000000, OutboxAndWebhookInbox1730000000001],
    migrationsTableName: 'schema_migrations',
    synchronize: false,
    // Tests deliberately trigger constraint violations (idempotency races), so SQL logging is off there.
    logging: process.env.NODE_ENV === 'test' ? false : ['error', 'warn'],
  };
}
