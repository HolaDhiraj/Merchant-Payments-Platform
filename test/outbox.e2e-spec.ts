import { Role } from '../src/shared/domain/role.enum';
import { OutboxHandlerRegistry } from '../src/shared/infrastructure/outbox/outbox-handler.registry';
import { OutboxRelay } from '../src/shared/infrastructure/outbox/outbox-relay';
import { RiskReviewOutboxHandler } from '../src/modules/merchant-applications/infrastructure/queue/risk-review-outbox.handler';
import { RISK_REVIEW_REQUESTED_TOPIC } from '../src/modules/merchant-applications/domain/ports/risk-review-queue';
import { TestContext, TestUser, auth, createTestContext, waitFor } from './support/test-app';
import { createApplication, getAsAdmin } from './support/lifecycle-helpers';

interface OutboxRow {
  attempts: number;
  last_error: string | null;
  dispatched_at: Date | null;
}

// Proves the transactional outbox: the review request is stored atomically with the submission,
// survives a broker outage, and is delivered once the broker is back.
describe('Transactional outbox (e2e)', () => {
  let ctx: TestContext;
  let admin: TestUser;
  let sales: TestUser;
  let registry: OutboxHandlerRegistry;
  let realHandler: RiskReviewOutboxHandler;

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await ctx.createUser(Role.ADMIN);
    sales = await ctx.createUser(Role.SALES);
    registry = ctx.app.get(OutboxHandlerRegistry);
    realHandler = ctx.app.get(RiskReviewOutboxHandler);
  });

  afterEach(() => registry.replace(realHandler));

  afterAll(() => ctx.close());

  const outboxRowsFor = (applicationId: string): Promise<OutboxRow[]> =>
    ctx.dataSource.query(
      `SELECT attempts, last_error, dispatched_at FROM outbox_messages WHERE payload->>'applicationId' = $1`,
      [applicationId],
    );

  it('stores the review request with the submission and marks it dispatched after delivery', async () => {
    const id = await createApplication(ctx, sales);
    await ctx.http.post(`/api/merchant-applications/${id}/submit`).set(auth(sales)).expect(202);

    await waitFor(
      () => getAsAdmin(ctx, admin, id),
      (body) => body.status === 'UNDER_REVIEW',
    );
    const rows = await outboxRowsFor(id);
    expect(rows).toHaveLength(1);
    expect(rows[0].dispatched_at).not.toBeNull();
  });

  it('writes nothing to the outbox when the transaction is rolled back', async () => {
    const id = await createApplication(ctx, sales);
    await ctx.http.post(`/api/merchant-applications/${id}/submit`).set(auth(sales)).expect(202);
    // Second submit is an invalid transition: the whole transaction must roll back.
    await ctx.http.post(`/api/merchant-applications/${id}/submit`).set(auth(sales)).expect(409);
    expect(await outboxRowsFor(id)).toHaveLength(1);
  });

  it('keeps the request while the broker is down and delivers it after recovery', async () => {
    // Simulate Redis/BullMQ being unavailable.
    registry.replace({
      topic: RISK_REVIEW_REQUESTED_TOPIC,
      handle: async () => {
        throw new Error('broker unavailable');
      },
    });

    const id = await createApplication(ctx, sales);
    const submitted = await ctx.http
      .post(`/api/merchant-applications/${id}/submit`)
      .set(auth(sales))
      .expect(202);
    expect(submitted.body.status).toBe('SUBMITTED');

    const [failed] = await waitFor(
      () => outboxRowsFor(id),
      (rows) => rows[0]?.attempts >= 1,
    );
    expect(failed.dispatched_at).toBeNull();
    expect(failed.last_error).toContain('broker unavailable');

    // Broker recovers; make the message due now instead of waiting for the backoff.
    registry.replace(realHandler);
    await ctx.dataSource.query(
      `UPDATE outbox_messages SET available_at = now() WHERE payload->>'applicationId' = $1`,
      [id],
    );
    await ctx.app.get(OutboxRelay).dispatchBatch();

    await waitFor(
      () => getAsAdmin(ctx, admin, id),
      (body) => body.status === 'UNDER_REVIEW',
    );
    const [delivered] = await outboxRowsFor(id);
    expect(delivered.dispatched_at).not.toBeNull();
  });
});
