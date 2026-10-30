import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { Role } from '../../src/shared/domain/role.enum';
import { CreateUserUseCase } from '../../src/modules/users/application/create-user.use-case';
import { RISK_PROVIDER } from '../../src/modules/merchant-applications/domain/ports/risk-provider';
import { RISK_REVIEW_QUEUE_NAME } from '../../src/modules/merchant-applications/infrastructure/queue/risk-review-queue.constants';
import { ControllableRiskProvider } from './fakes/controllable-risk-provider';

export interface TestUser {
  id: string;
  email: string;
  role: Role;
  token: string;
}

export interface TestContext {
  app: INestApplication;
  http: ReturnType<typeof request>;
  dataSource: DataSource;
  riskProvider: ControllableRiskProvider;
  queue: Queue;
  createUser(role: Role, label?: string): Promise<TestUser>;
  close(): Promise<void>;
}

// Synthetic test password (not a real credential): generated per run.
const TEST_PASSWORD = `Pw-${Math.random().toString(36).slice(2)}-2026`;
let userCounter = 0;

// Boots the real application (real PostgreSQL, Redis, BullMQ worker, guards, pipes, filters)
// with only the external risk vendor replaced by a controllable fake.
export async function createTestContext(): Promise<TestContext> {
  const riskProvider = new ControllableRiskProvider();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(RISK_PROVIDER)
    .useValue(riskProvider)
    .compile();

  // Same options as main.ts: raw body is required for webhook signature checks.
  const app = moduleRef.createNestApplication({ rawBody: true });
  configureApp(app);
  await app.init();

  const dataSource = app.get(DataSource);
  await dataSource.runMigrations();
  await dataSource.query(
    'TRUNCATE TABLE audit_logs, risk_assessments, merchant_applications, users, outbox_messages, processed_webhook_events RESTART IDENTITY CASCADE',
  );

  const queue = app.get<Queue>(getQueueToken(RISK_REVIEW_QUEUE_NAME));
  const http = request(app.getHttpServer());

  return {
    app,
    http,
    dataSource,
    riskProvider,
    queue,
    async createUser(role: Role, label = role.toLowerCase()): Promise<TestUser> {
      userCounter += 1;
      const email = `${label}.${userCounter}.${Date.now()}@example.test`;
      const user = await app
        .get(CreateUserUseCase)
        .execute(null, { email, password: TEST_PASSWORD, role, fullName: `Test ${label}` });
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: TEST_PASSWORD })
        .expect(200);
      return { id: user.id, email, role, token: response.body.accessToken };
    },
    async close(): Promise<void> {
      await queue.obliterate({ force: true });
      await app.close();
    },
  };
}

export { TEST_PASSWORD };

// Polls until the predicate holds (used to wait for the background worker).
export async function waitFor<T>(
  probe: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 10000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last = await probe();
  while (!predicate(last)) {
    if (Date.now() > deadline) {
      throw new Error(
        `Condition not met within ${timeoutMs}ms; last value: ${JSON.stringify(last)}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    last = await probe();
  }
  return last;
}

export function auth(user: TestUser): { Authorization: string } {
  return { Authorization: `Bearer ${user.token}` };
}

// Valid application payload with synthetic data only.
export function applicationPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    businessName: 'Test Coffee',
    legalBusinessName: 'Test Coffee LLC',
    businessType: 'LLC',
    taxId: '00-0001234',
    owner: { fullName: 'Test Owner', email: 'owner@example.test', phone: '+15555550100' },
    processing: {
      merchantCategoryCode: '5812',
      currency: 'USD',
      expectedMonthlyVolumeMinor: 2500000,
      averageTicketMinor: 4500,
      salesChannel: 'CARD_PRESENT',
    },
    ...overrides,
  };
}
