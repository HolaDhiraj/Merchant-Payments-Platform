import { randomBytes } from 'crypto';
import './silence-logger';

// Integration test environment. Connection settings (host, port, user, password) come from the
// developer's .env or CI variables; only the database name is forced to the dedicated test DB.
// Secrets are generated per run, so tests never rely on committed credentials.
process.env.NODE_ENV = 'test';
process.env.DATABASE_NAME = process.env.TEST_DATABASE_NAME ?? 'merchant_platform_test';
process.env.JWT_SECRET = randomBytes(48).toString('base64url');
process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.QUEUE_PREFIX = `test-${randomBytes(4).toString('hex')}`;
process.env.RISK_WEBHOOK_SECRET = randomBytes(48).toString('base64url');
process.env.RISK_WEBHOOK_TOLERANCE_SECONDS = '300';
process.env.OUTBOX_RELAY_ENABLED = 'true';
process.env.OUTBOX_POLL_INTERVAL_MS = '50';

// Fast retries so failure paths finish in well under a second.
process.env.RISK_REVIEW_MAX_ATTEMPTS = '3';
process.env.RISK_REVIEW_BACKOFF_MS = '20';
process.env.RISK_PROVIDER_TRANSIENT_FAILURE_RATE = '0';
process.env.RISK_PROVIDER_LATENCY_MS = '0';
process.env.LOGIN_THROTTLE_LIMIT = process.env.LOGIN_THROTTLE_LIMIT_TEST ?? '1000';
