import { Role } from '../src/shared/domain/role.enum';
import {
  TestContext,
  TestUser,
  applicationPayload,
  auth,
  createTestContext,
} from './support/test-app';
import { createApplication, getAsAdmin, prepareUnderReview } from './support/lifecycle-helpers';

// Proves that role checks and object-level authorization cannot be bypassed.
describe('Authorization and object-level isolation (e2e)', () => {
  let ctx: TestContext;
  let admin: TestUser;
  let salesA: TestUser;
  let salesB: TestUser;
  let reviewer: TestUser;
  let otherReviewer: TestUser;
  let applicationOfA: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await ctx.createUser(Role.ADMIN);
    salesA = await ctx.createUser(Role.SALES, 'sales-a');
    salesB = await ctx.createUser(Role.SALES, 'sales-b');
    reviewer = await ctx.createUser(Role.REVIEWER);
    otherReviewer = await ctx.createUser(Role.REVIEWER, 'other-reviewer');
    applicationOfA = await createApplication(ctx, salesA);
  });

  afterAll(() => ctx.close());

  describe("a SALES user cannot read or change another user's application by id", () => {
    it('GET returns 404 (existence is not revealed)', async () => {
      const response = await ctx.http
        .get(`/api/merchant-applications/${applicationOfA}`)
        .set(auth(salesB))
        .expect(404);
      expect(JSON.stringify(response.body)).not.toContain('Test Coffee');
    });

    it('PATCH returns 404 and the data is unchanged', async () => {
      await ctx.http
        .patch(`/api/merchant-applications/${applicationOfA}`)
        .set(auth(salesB))
        .send({ businessName: 'Hijacked' })
        .expect(404);
      expect((await getAsAdmin(ctx, admin, applicationOfA)).businessName).toBe('Test Coffee');
    });

    it('submit returns 404 and the status is unchanged', async () => {
      await ctx.http
        .post(`/api/merchant-applications/${applicationOfA}/submit`)
        .set(auth(salesB))
        .expect(404);
      expect((await getAsAdmin(ctx, admin, applicationOfA)).status).toBe('DRAFT');
    });

    it('risk assessment of another user’s application is not readable', async () => {
      await ctx.http
        .get(`/api/merchant-applications/${applicationOfA}/risk-assessment`)
        .set(auth(salesB))
        .expect(404);
    });

    it('the list endpoint only returns own applications, even with filters', async () => {
      await createApplication(ctx, salesB, { businessName: 'B Shop' });
      const response = await ctx.http
        .get('/api/merchant-applications?status=DRAFT')
        .set(auth(salesB))
        .expect(200);
      expect(response.body.items.map((item: { createdById: string }) => item.createdById)).toEqual([
        salesB.id,
      ]);
    });

    it('the owner can still read and edit it', async () => {
      await ctx.http.get(`/api/merchant-applications/${applicationOfA}`).set(auth(salesA)).expect(200);
      await ctx.http
        .patch(`/api/merchant-applications/${applicationOfA}`)
        .set(auth(salesA))
        .send({ businessName: 'Test Coffee' })
        .expect(200);
    });
  });

  describe('role restrictions', () => {
    it('SALES cannot assign reviewers, record decisions, retry risk or read audit logs', async () => {
      await ctx.http
        .put(`/api/merchant-applications/${applicationOfA}/reviewer`)
        .set(auth(salesA))
        .send({ reviewerId: reviewer.id })
        .expect(403);
      await ctx.http
        .post(`/api/merchant-applications/${applicationOfA}/decision`)
        .set(auth(salesA))
        .send({ decision: 'APPROVE' })
        .expect(403);
      await ctx.http
        .post(`/api/merchant-applications/${applicationOfA}/risk-review/retry`)
        .set(auth(salesA))
        .expect(403);
      await ctx.http.get('/api/audit-logs').set(auth(salesA)).expect(403);
    });

    it('SALES cannot create users (no privilege escalation)', async () => {
      await ctx.http
        .post('/api/users')
        .set(auth(salesA))
        .send({
          email: 'evil@example.test',
          fullName: 'Evil',
          role: 'ADMIN',
          password: 'Password12345',
        })
        .expect(403);
    });

    it('REVIEWER cannot create or edit applications and cannot see drafts', async () => {
      await ctx.http
        .post('/api/merchant-applications')
        .set(auth(reviewer))
        .send(applicationPayload())
        .expect(403);
      await ctx.http
        .patch(`/api/merchant-applications/${applicationOfA}`)
        .set(auth(reviewer))
        .send({ businessName: 'x' })
        .expect(403);
      await ctx.http
        .get(`/api/merchant-applications/${applicationOfA}`)
        .set(auth(reviewer))
        .expect(404);
    });

    it('rejects mass assignment of protected fields (status, createdById, riskLevel)', async () => {
      await ctx.http
        .post('/api/merchant-applications')
        .set(auth(salesA))
        .send(applicationPayload({ status: 'APPROVED' }))
        .expect(400);
      await ctx.http
        .patch(`/api/merchant-applications/${applicationOfA}`)
        .set(auth(salesA))
        .send({ createdById: salesB.id, riskLevel: 'LOW' })
        .expect(400);
    });

    it('rejects malformed ids before touching the database', async () => {
      await ctx.http.get('/api/merchant-applications/not-a-uuid').set(auth(admin)).expect(400);
    });
  });

  describe('only the assigned REVIEWER may record a decision', () => {
    let applicationId: string;

    beforeAll(async () => {
      applicationId = await prepareUnderReview(ctx, salesA, admin, reviewer);
    });

    it('another reviewer gets 403 and the status does not change', async () => {
      await ctx.http
        .post(`/api/merchant-applications/${applicationId}/decision`)
        .set(auth(otherReviewer))
        .send({ decision: 'APPROVE' })
        .expect(403);
      expect((await getAsAdmin(ctx, admin, applicationId)).status).toBe('UNDER_REVIEW');
    });

    it('an ADMIN cannot record the decision either (segregation of duties)', async () => {
      await ctx.http
        .post(`/api/merchant-applications/${applicationId}/decision`)
        .set(auth(admin))
        .send({ decision: 'APPROVE' })
        .expect(403);
    });

    it('the assigned reviewer can decide', async () => {
      const response = await ctx.http
        .post(`/api/merchant-applications/${applicationId}/decision`)
        .set(auth(reviewer))
        .send({ decision: 'APPROVE' })
        .expect(200);
      expect(response.body.status).toBe('APPROVED');
    });

    it('cannot assign a non-reviewer as reviewer', async () => {
      const id = await createApplication(ctx, salesA);
      await ctx.http
        .put(`/api/merchant-applications/${id}/reviewer`)
        .set(auth(admin))
        .send({ reviewerId: salesB.id })
        .expect(422);
    });
  });
});
