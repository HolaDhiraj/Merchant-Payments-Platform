import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { envValidationSchema } from './config/env.validation';
import {
  databaseConfig,
  jwtConfig,
  outboxConfig,
  paymentsConfig,
  redisConfig,
  riskReviewConfig,
  riskWebhookConfig,
  securityConfig,
} from './config/app.config';
import { buildTypeOrmOptions } from './infrastructure/database/typeorm-options';
import { SharedInfrastructureModule } from './shared/infrastructure/shared-infrastructure.module';
import { CorrelationIdMiddleware } from './shared/presentation/middleware/correlation-id.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AuditModule } from './modules/audit/audit.module';
import { MerchantApplicationsModule } from './modules/merchant-applications/merchant-applications.module';
import { MerchantsModule } from './modules/merchants/merchants.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CustomersModule } from './modules/customers/customers.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { HealthModule } from './modules/health/health.module';

// Root module: wires configuration, PostgreSQL, Redis/BullMQ and the feature modules.
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        databaseConfig,
        redisConfig,
        jwtConfig,
        securityConfig,
        riskReviewConfig,
        outboxConfig,
        riskWebhookConfig,
        paymentsConfig,
      ],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (config: ConfigType<typeof databaseConfig>) => buildTypeOrmOptions(config),
    }),
    BullModule.forRootAsync({
      inject: [redisConfig.KEY],
      useFactory: (config: ConfigType<typeof redisConfig>) => ({
        connection: { host: config.host, port: config.port, password: config.password },
        prefix: config.queuePrefix,
      }),
    }),
    SharedInfrastructureModule,
    AuditModule,
    UsersModule,
    AuthModule,
    MerchantApplicationsModule,
    MerchantsModule,
    CatalogModule,
    CustomersModule,
    PaymentsModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
