import { randomBytes } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { parseEnv } from 'util';
import './silence-logger';

// Integration test environment. Connection settings (host, port, user, password) come from the
// developer's .env or CI variables; the database and schema are forced to dedicated test ones
// (TEST_DATABASE_NAME / TEST_DATABASE_SCHEMA), because the suites truncate every table they use.
// Secrets are generated per run, so tests never rely on committed credentials.
// Jest gives each test file its own copy of process.env, so .env is copied in here explicitly.
// Variables that are already set (CI, the shell) win over the file.
if (existsSync('.env')) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync('.env', 'utf8')))) {
    process.env[key] ??= value;
  }
}
process.env.NODE_ENV = 'test';
process.env.DATABASE_NAME = process.env.TEST_DATABASE_NAME ?? 'merchant_platform_test';
process.env.DATABASE_SCHEMA = process.env.TEST_DATABASE_SCHEMA ?? 'public';
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
