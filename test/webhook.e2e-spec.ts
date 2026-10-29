import { randomUUID } from 'crypto';
import { Role } from '../src/shared/domain/role.enum';
import { HmacWebhookSignatureVerifier } from '../src/modules/merchant-applications/infrastructure/webhooks/hmac-webhook-signature.verifier';
import { TestContext, TestUser, auth, createTestContext } from './support/test-app';
import { createApplication, getAsAdmin } from './support/lifecycle-helpers';

// Exercises the signed third-party callback: signature, replay window, event de-duplication
// and result idempotency.
describe('Risk provider webhook (e2e)', () => {
  let ctx: TestContext;
  let admin: TestUser;
  let sales: TestUser;
  const secret = (): string => process.env.RISK_WEBHOOK_SECRET as string;

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await ctx.createUser(Role.ADMIN);
    sales = await ctx.createUser(Role.SALES);
  });

  afterAll(() => ctx.close());

  // Puts an application into SUBMITTED / PENDING without queueing a worker job,
  // so the webhook is the only channel delivering the result.
  async function awaitingApplication(): Promise<string> {
    const id = await createApplication(ctx, sales);
    await ctx.dataSource.query(
      `UPDATE merchant_applications SET status = 'SUBMITTED', risk_status = 'PENDING', submission_count = 1 WHERE id = $1`,
      [id],
    );
    return id;
  }

  function body(applicationId: string, overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      eventType: 'risk_assessment.completed',
      applicationId,
      submissionNumber: 1,
      provider: 'acme-kyb',
      providerReference: 'kyb_ref_001',
      score: 72,
      level: 'HIGH',
      reasons: ['HIGH_RISK_MCC'],
      assessedAt: new Date().toISOString(),
      ...overrides,
    });
  }

  function send(
    payload: string,
    options: { eventId?: string; timestamp?: number; signature?: string } = {},
  ) {
    const eventId = options.eventId ?? `evt_${randomUUID().replace(/-/g, '')}`;
    const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
    const signature =
      options.signature ?? HmacWebhookSignatureVerifier.sign(secret(), eventId, timestamp, payload);
    return ctx.http
      .post('/webhooks/risk-provider')
      .set('content-type', 'application/json')
      .set('x-webhook-id', eventId)
      .set('x-webhook-timestamp', timestamp)
      .set('x-webhook-signature', signature)
      .send(payload);
  }

  const assessmentCount = async (id: string): Promise<number> => {
    const [row] = await ctx.dataSource.query(
      'SELECT count(*)::int AS n FROM risk_assessments WHERE application_id = $1',
      [id],
    );
    return row.n;
  };

  it('applies a correctly signed result and records it in the audit trail', async () => {
    const id = await awaitingApplication();
    const response = await send(body(id)).expect(200);
    expect(response.body).toEqual({ received: true, outcome: 'APPLIED' });

    const application = await getAsAdmin(ctx, admin, id);
    expect(application).toMatchObject({ status: 'UNDER_REVIEW', riskLevel: 'HIGH', riskScore: 72 });

    const audit = await ctx.http
      .get(`/audit-logs?entityId=${id}&action=RISK_REVIEW_COMPLETED`)
      .set(auth(admin))
      .expect(200);
    expect(audit.body.items[0].metadata.source).toBe('WEBHOOK');
  });

  it('processes a redelivered event only once', async () => {
    const id = await awaitingApplication();
    const payload = body(id);
    const eventId = `evt_${randomUUID().replace(/-/g, '')}`;

    await send(payload, { eventId }).expect(200);
    const second = await send(payload, { eventId }).expect(200);
    expect(second.body.outcome).toBe('DUPLICATE_EVENT');
    expect(await assessmentCount(id)).toBe(1);
  });

  it('ignores a second, different result for the same submission', async () => {
    const id = await awaitingApplication();
    await send(body(id, { score: 10, level: 'LOW', reasons: [] })).expect(200);
    const second = await send(body(id, { score: 95, level: 'HIGH' })).expect(200);
    expect(second.body.outcome).toBe('ALREADY_PROCESSED');
    expect((await getAsAdmin(ctx, admin, id)).riskLevel).toBe('LOW');
  });

  it('rejects an invalid signature with 401 and changes nothing', async () => {
    const id = await awaitingApplication();
    await send(body(id), { signature: `v1=${'0'.repeat(64)}` }).expect(401);
    expect((await getAsAdmin(ctx, admin, id)).status).toBe('SUBMITTED');
  });

  it('rejects a body modified after signing', async () => {
    const id = await awaitingApplication();
    const eventId = 'evt_tampered00001';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = HmacWebhookSignatureVerifier.sign(secret(), eventId, timestamp, body(id));
    await send(body(id, { level: 'LOW' }), {
      eventId,
      timestamp: Number(timestamp),
      signature,
    }).expect(401);
  });

  it('rejects a replayed request outside the tolerance window', async () => {
    const id = await awaitingApplication();
    await send(body(id), { timestamp: Math.floor(Date.now() / 1000) - 3600 }).expect(401);
  });

  it('rejects requests without signature headers', async () => {
    await ctx.http.post('/webhooks/risk-provider').send({}).expect(401);
  });

  it('validates the payload after the signature check', async () => {
    const id = await awaitingApplication();
    await send(body(id, { score: 500 })).expect(400);
    await send(body(id, { eventType: 'something.else' })).expect(400);
  });

  it('acknowledges results for unknown applications so the provider stops retrying', async () => {
    const response = await send(body(randomUUID())).expect(200);
    expect(response.body.outcome).toBe('APPLICATION_NOT_FOUND');
  });
});
