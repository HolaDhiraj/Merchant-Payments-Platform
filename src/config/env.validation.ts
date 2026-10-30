import * as Joi from 'joi';

// Validates every environment variable at boot so the app fails fast on bad configuration
// instead of failing later in the middle of a request.
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),

  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().port().default(5432),
  DATABASE_NAME: Joi.string().required(),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_SSL: Joi.boolean().default(false),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  // Namespaces BullMQ keys, so several environments can share one Redis safely.
  QUEUE_PREFIX: Joi.string().default('mpp'),

  // A placeholder value must never reach a running process.
  JWT_SECRET: Joi.string().min(32).invalid('CHANGE_ME').required(),
  JWT_EXPIRES_IN_SECONDS: Joi.number().integer().min(60).max(86400).default(900),
  JWT_ISSUER: Joi.string().default('merchant-payments-platform'),
  JWT_AUDIENCE: Joi.string().default('merchant-payments-api'),

  FIELD_ENCRYPTION_KEY: Joi.string().base64().invalid('CHANGE_ME').required(),

  RISK_REVIEW_MAX_ATTEMPTS: Joi.number().integer().min(1).max(20).default(5),
  RISK_REVIEW_BACKOFF_MS: Joi.number().integer().min(10).default(2000),
  RISK_PROVIDER_TRANSIENT_FAILURE_RATE: Joi.number().min(0).max(1).default(0),
  RISK_PROVIDER_LATENCY_MS: Joi.number().integer().min(0).default(0),

  // Transactional outbox relay (publishes committed events to BullMQ).
  OUTBOX_RELAY_ENABLED: Joi.boolean().default(true),
  OUTBOX_POLL_INTERVAL_MS: Joi.number().integer().min(10).default(500),
  OUTBOX_BATCH_SIZE: Joi.number().integer().min(1).max(500).default(50),

  // Shared secret used by the risk provider to sign webhook callbacks (HMAC-SHA256).
  RISK_WEBHOOK_SECRET: Joi.string().min(32).invalid('CHANGE_ME').required(),
  RISK_WEBHOOK_TOLERANCE_SECONDS: Joi.number().integer().min(30).max(3600).default(300),

  LOGIN_THROTTLE_LIMIT: Joi.number().integer().min(1).default(5),
  LOGIN_THROTTLE_TTL_SECONDS: Joi.number().integer().min(1).default(60),
  // Consecutive wrong passwords before an account is locked until an admin unlocks it.
  LOGIN_LOCKOUT_THRESHOLD: Joi.number().integer().min(3).max(20).default(5),
});
