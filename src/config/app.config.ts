import { registerAs } from '@nestjs/config';

// Typed configuration groups. Consumers inject these instead of reading process.env directly,
// which keeps configuration in one place and makes it easy to override in tests.

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DATABASE_HOST as string,
  port: Number(process.env.DATABASE_PORT ?? 5432),
  name: process.env.DATABASE_NAME as string,
  schema: process.env.DATABASE_SCHEMA ?? 'public',
  user: process.env.DATABASE_USER as string,
  password: process.env.DATABASE_PASSWORD as string,
  ssl: process.env.DATABASE_SSL === 'true',
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST as string,
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  queuePrefix: process.env.QUEUE_PREFIX ?? 'mpp',
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET as string,
  expiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 900),
  issuer: process.env.JWT_ISSUER ?? 'merchant-payments-platform',
  audience: process.env.JWT_AUDIENCE ?? 'merchant-payments-api',
}));

export const securityConfig = registerAs('security', () => ({
  fieldEncryptionKey: process.env.FIELD_ENCRYPTION_KEY as string,
  loginThrottleLimit: Number(process.env.LOGIN_THROTTLE_LIMIT ?? 5),
  loginThrottleTtlSeconds: Number(process.env.LOGIN_THROTTLE_TTL_SECONDS ?? 60),
  loginLockoutThreshold: Number(process.env.LOGIN_LOCKOUT_THRESHOLD ?? 5),
}));

// The simulated card network / bank used until a real acquirer is connected.
export const paymentsConfig = registerAs('payments', () => ({
  bankSimulatorPin: process.env.BANK_SIMULATOR_PIN ?? '0000',
  processorLatencyMs: Number(process.env.PAYMENT_PROCESSOR_LATENCY_MS ?? 0),
}));

export const riskReviewConfig = registerAs('riskReview', () => ({
  maxAttempts: Number(process.env.RISK_REVIEW_MAX_ATTEMPTS ?? 5),
  backoffMs: Number(process.env.RISK_REVIEW_BACKOFF_MS ?? 2000),
  providerTransientFailureRate: Number(process.env.RISK_PROVIDER_TRANSIENT_FAILURE_RATE ?? 0),
  providerLatencyMs: Number(process.env.RISK_PROVIDER_LATENCY_MS ?? 0),
}));

export const outboxConfig = registerAs('outbox', () => ({
  relayEnabled: process.env.OUTBOX_RELAY_ENABLED !== 'false',
  pollIntervalMs: Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 500),
  batchSize: Number(process.env.OUTBOX_BATCH_SIZE ?? 50),
}));

export const riskWebhookConfig = registerAs('riskWebhook', () => ({
  secret: process.env.RISK_WEBHOOK_SECRET as string,
  toleranceSeconds: Number(process.env.RISK_WEBHOOK_TOLERANCE_SECONDS ?? 300),
}));

export type DatabaseConfig = ReturnType<typeof databaseConfig>;
export type RedisConfig = ReturnType<typeof redisConfig>;
export type JwtConfig = ReturnType<typeof jwtConfig>;
export type SecurityConfig = ReturnType<typeof securityConfig>;
export type RiskReviewConfig = ReturnType<typeof riskReviewConfig>;
export type PaymentsConfig = ReturnType<typeof paymentsConfig>;
export type OutboxConfig = ReturnType<typeof outboxConfig>;
export type RiskWebhookConfig = ReturnType<typeof riskWebhookConfig>;
