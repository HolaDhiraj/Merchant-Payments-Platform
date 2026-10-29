import { Role } from '../src/shared/domain/role.enum';
import { MerchantApplication } from '../src/modules/merchant-applications/domain/model/merchant-application';
import {
  RISK_REVIEW_QUEUE,
  RiskReviewQueue,
} from '../src/modules/merchant-applications/domain/ports/risk-review-queue';
import {
  ProcessRiskReviewUseCase,
  RiskReviewOutcome,
} from '../src/modules/merchant-applications/application/use-cases/process-risk-review.use-case';
import { TestContext, TestUser, auth, createTestContext, waitFor } from './support/test-app';
import { createApplication, getAsAdmin } from './support/lifecycle-helpers';

// Exercises the real BullMQ worker against Redis: retries with backoff, permanent failure,
// operational retry and idempotency under duplicate delivery.
describe('Asynchronous risk review (e2e)', () => {
  let ctx: TestContext;
  let admin: TestUser;
  let sales: TestUser;

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await ctx.createUser(Role.ADMIN);
    sales = await ctx.createUser(Role.SALES);
  });

  beforeEach(() => ctx.riskProvider.reset());

  afterAll(() => ctx.close());

  const assessmentCount = async (id: string): Promise<number> => {
    const [row] = await ctx.dataSource.query(
      'SELECT count(*)::int AS n FROM risk_assessments WHERE application_id = $1',
      [id],
    );
    return row.n;
  };

  it('retries transient provider failures with backoff and then completes', async () => {
    ctx.riskProvider.transientFailuresRemaining = 2;
    const id = await createApplication(ctx, sales);

    const submitted = await ctx.http
      .post(`/merchant-applications/${id}/submit`)
      .set(auth(sales))
      .expect(202);
    expect(submitted.body).toMatchObject({ status: 'SUBMITTED', riskStatus: 'PENDING' });

    const done = await waitFor(
      () => getAsAdmin(ctx, admin, id),
      (body) => body.status === 'UNDER_REVIEW',
    );
    expect(done.riskStatus).toBe('COMPLETED');
    // 2 failures + 1 success, all with the same idempotency key
    expect(ctx.riskProvider.calls).toHaveLength(3);
    expect(new Set(ctx.riskProvider.calls.map((call) => call.idempotencyKey)).size).toBe(1);
    expect(await assessmentCount(id)).toBe(1);
  });

  it('marks the review FAILED after all attempts, then an admin retry completes it', async () => {
    ctx.riskProvider.alwaysFailTransiently = true;
    const id = await createApplication(ctx, sales);
    await ctx.http.post(`/merchant-applications/${id}/submit`).set(auth(sales)).expect(202);

    const failed = await waitFor(
      () => getAsAdmin(ctx, admin, id),
      (body) => body.riskStatus === 'FAILED',
    );
    expect(failed.status).toBe('SUBMITTED');
    expect(ctx.riskProvider.calls).toHaveLength(3); // RISK_REVIEW_MAX_ATTEMPTS in tests

    const failureAudit = await ctx.http
      .get(`/audit-logs?entityId=${id}&action=RISK_REVIEW_FAILED`)
      .set(auth(admin))
      .expect(200);
    expect(failureAudit.body.items).toHaveLength(1);

    // Provider recovers; admin re-queues the job
    ctx.riskProvider.reset();
    await ctx.http
      .post(`/merchant-applications/${id}/risk-review/retry`)
      .set(auth(admin))
      .expect(202);
    const recovered = await waitFor(
      () => getAsAdmin(ctx, admin, id),
      (body) => body.status === 'UNDER_REVIEW',
    );
    expect(recovered.riskStatus).toBe('COMPLETED');
    expect(await assessmentCount(id)).toBe(1);
  });

  it('stops retrying immediately on a permanent provider error', async () => {
    ctx.riskProvider.failPermanently = true;
    const id = await createApplication(ctx, sales);
    await ctx.http.post(`/merchant-applications/${id}/submit`).set(auth(sales)).expect(202);

    await waitFor(
      () => getAsAdmin(ctx, admin, id),
      (body) => body.riskStatus === 'FAILED',
    );
    expect(ctx.riskProvider.calls).toHaveLength(1);
  });

  it('cannot retry a risk review that already completed', async () => {
    const id = await createApplication(ctx, sales);
    await ctx.http.post(`/merchant-applications/${id}/submit`).set(auth(sales)).expect(202);
    await waitFor(
      () => getAsAdmin(ctx, admin, id),
      (body) => body.status === 'UNDER_REVIEW',
    );
    await ctx.http
      .post(`/merchant-applications/${id}/risk-review/retry`)
      .set(auth(admin))
      .expect(409);
  });

  it('is idempotent when the same job is enqueued several times', async () => {
    const id = await createApplication(ctx, sales);
    await ctx.http.post(`/merchant-applications/${id}/submit`).set(auth(sales)).expect(202);

    // Simulate duplicate publishes (client retries, at-least-once delivery)
    const queue = ctx.app.get<RiskReviewQueue>(RISK_REVIEW_QUEUE);
    const job = {
      applicationId: id,
      submissionNumber: 1,
      idempotencyKey: MerchantApplication.riskReviewIdempotencyKey(id, 1),
    };
    await Promise.all([queue.enqueue(job), queue.enqueue(job), queue.enqueue(job)]);

    await waitFor(
      () => getAsAdmin(ctx, admin, id),
      (body) => body.status === 'UNDER_REVIEW',
    );
    // Give any stray duplicate a chance to run before asserting.
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(await assessmentCount(id)).toBe(1);
    const completions = await ctx.http
      .get(`/audit-logs?entityId=${id}&action=RISK_REVIEW_COMPLETED`)
      .set(auth(admin))
      .expect(200);
    expect(completions.body.items).toHaveLength(1);
  });

  it('applies one result when two workers process the same job concurrently', async () => {
    // Hold the BullMQ worker back by creating the job state directly, then race two executions.
    const id = await createApplication(ctx, sales);
    await ctx.dataSource.query(
      `UPDATE merchant_applications SET status = 'SUBMITTED', risk_status = 'PENDING', submission_count = 1 WHERE id = $1`,
      [id],
    );
    const job = {
      applicationId: id,
      submissionNumber: 1,
      idempotencyKey: MerchantApplication.riskReviewIdempotencyKey(id, 1),
    };
    const useCase = ctx.app.get(ProcessRiskReviewUseCase);

    const results = await Promise.allSettled([
      useCase.execute(job),
      useCase.execute(job),
      useCase.execute(job),
    ]);
    const completed = results.filter(
      (result) => result.status === 'fulfilled' && result.value === RiskReviewOutcome.COMPLETED,
    );

    // Exactly one winner; losers either skip or hit the optimistic lock (and would be retried by BullMQ).
    expect(completed).toHaveLength(1);
    expect(await assessmentCount(id)).toBe(1);
    expect((await getAsAdmin(ctx, admin, id)).status).toBe('UNDER_REVIEW');
  });

  it('links worker audit entries to the HTTP request that submitted the application', async () => {
    const id = await createApplication(ctx, sales);
    const submitted = await ctx.http
      .post(`/merchant-applications/${id}/submit`)
      .set(auth(sales))
      .set('x-correlation-id', 'trace-submit-0001')
      .expect(202);
    expect(submitted.headers['x-correlation-id']).toBe('trace-submit-0001');

    await waitFor(
      () => getAsAdmin(ctx, admin, id),
      (body) => body.status === 'UNDER_REVIEW',
    );
    const audit = await ctx.http
      .get(`/audit-logs?entityId=${id}&action=RISK_REVIEW_COMPLETED`)
      .set(auth(admin))
      .expect(200);
    expect(audit.body.items[0].correlationId).toBe('trace-submit-0001');
  });

  it('queue payloads contain identifiers only, never merchant data', async () => {
    const id = await createApplication(ctx, sales);
    ctx.riskProvider.alwaysFailTransiently = true;
    await ctx.http.post(`/merchant-applications/${id}/submit`).set(auth(sales)).expect(202);
    const stored = await waitFor(
      () => ctx.queue.getJob(`risk-review_${id}_1`),
      (job) => job !== undefined,
    );
    expect(Object.keys(stored!.data).sort()).toEqual([
      'applicationId',
      'correlationId',
      'idempotencyKey',
      'submissionNumber',
    ]);
    expect(JSON.stringify(stored!.data)).not.toContain('0001234');
  });
});
