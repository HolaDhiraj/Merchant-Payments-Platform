import { DataSourceOptions } from 'typeorm';
import { UserOrmEntity } from '../../modules/users/infrastructure/user.orm-entity';
import { AuditLogOrmEntity } from '../../modules/audit/infrastructure/audit-log.orm-entity';
import { MerchantApplicationOrmEntity } from '../../modules/merchant-applications/infrastructure/persistence/merchant-application.orm-entity';
import { RiskAssessmentOrmEntity } from '../../modules/merchant-applications/infrastructure/persistence/risk-assessment.orm-entity';
import { InitialSchema1730000000000 } from './migrations/1730000000000-InitialSchema';
import { OutboxAndWebhookInbox1730000000001 } from './migrations/1730000000001-OutboxAndWebhookInbox';
import { UserLoginLockout1730000000002 } from './migrations/1730000000002-UserLoginLockout';
import { MerchantPortal1730000000003 } from './migrations/1730000000003-MerchantPortal';
import { MerchantOrmEntity } from '../../modules/merchants/infrastructure/merchant.orm-entity';
import { CategoryOrmEntity, ProductOrmEntity } from '../../modules/catalog/infrastructure/catalog.orm-entities';
import { CustomerOrmEntity, LoyaltyEntryOrmEntity } from '../../modules/customers/infrastructure/customer.orm-entities';
import {
  PaymentLineOrmEntity,
  PaymentTransactionOrmEntity,
} from '../../modules/payments/infrastructure/payment.orm-entities';
import { OutboxMessageOrmEntity } from '../../shared/infrastructure/outbox/outbox-message.orm-entity';
import { ProcessedWebhookEventOrmEntity } from '../../modules/merchant-applications/infrastructure/webhooks/processed-webhook-event.orm-entity';

export interface DatabaseConnectionSettings {
  host: string;
  port: number;
  name: string;
  schema: string;
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
    // Entities, the migrations table and every unqualified name in raw SQL resolve to this schema
    // only (search_path has no fallback), so a shared database's other schemas are never touched.
    schema: settings.schema,
    extra: { options: `-c search_path=${settings.schema}` },
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
      MerchantOrmEntity,
      CategoryOrmEntity,
      ProductOrmEntity,
      CustomerOrmEntity,
      LoyaltyEntryOrmEntity,
      PaymentTransactionOrmEntity,
      PaymentLineOrmEntity,
    ],
    migrations: [
      InitialSchema1730000000000,
      OutboxAndWebhookInbox1730000000001,
      UserLoginLockout1730000000002,
      MerchantPortal1730000000003,
    ],
    migrationsTableName: 'schema_migrations',
    synchronize: false,
    // Tests deliberately trigger constraint violations (idempotency races), so SQL logging is off there.
    logging: process.env.NODE_ENV === 'test' ? false : ['error', 'warn'],
  };
}
