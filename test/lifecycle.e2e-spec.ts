import { Role } from '../src/shared/domain/role.enum';
import { TestContext, TestUser, auth, createTestContext, waitFor } from './support/test-app';
import { createApplication, getAsAdmin, submitAndAwaitRisk } from './support/lifecycle-helpers';

describe('Merchant application lifecycle (e2e)', () => {
  let ctx: TestContext;
  let admin: TestUser;
  let sales: TestUser;
  let reviewer: TestUser;

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await ctx.createUser(Role.ADMIN);
    sales = await ctx.createUser(Role.SALES);
    reviewer = await ctx.createUser(Role.REVIEWER);
  });

  afterAll(() => ctx.close());

  it('runs the full journey: draft -> submitted -> under review -> info requested -> resubmitted -> approved', async () => {
    // Create (DRAFT) with normalised input
    const created = await ctx.http
      .post('/api/merchant-applications')
      .set(auth(sales))
      .send({
        businessName: 'Journey Cafe',
        legalBusinessName: 'Journey Cafe LLC',
        businessType: 'LLC',
        taxId: '00-0005678',
        owner: { fullName: 'Test Owner', email: 'Owner@Example.test', phone: '+15555550100' },
        processing: {
          merchantCategoryCode: '5812',
          currency: 'usd',
          expectedMonthlyVolumeMinor: 2500000,
          averageTicketMinor: 4500,
          salesChannel: 'CARD_PRESENT',
        },
      })
      .expect(201);
    const id = created.body.id;
    expect(created.body).toMatchObject({
      status: 'DRAFT',
      riskStatus: 'NOT_STARTED',
      taxIdMasked: '*****5678',
    });
    expect(created.body.owner.email).toBe('owner@example.test');
    expect(created.body.processing.currency).toBe('USD');
    expect(created.body).not.toHaveProperty('taxId');

    // Edit while DRAFT
    await ctx.http
      .patch(`/api/merchant-applications/${id}`)
      .set(auth(sales))
      .send({ businessName: 'Journey Coffee' })
      .expect(200);

    // Submit -> worker completes risk -> UNDER_REVIEW
    const reviewed = await submitAndAwaitRisk(ctx, sales, admin, id);
    expect(reviewed).toMatchObject({
      riskStatus: 'COMPLETED',
      riskLevel: 'LOW',
      submissionCount: 1,
    });

    // Not editable and not re-submittable any more
    await ctx.http
      .patch(`/api/merchant-applications/${id}`)
      .set(auth(sales))
      .send({ businessName: 'Late' })
      .expect(409);
    await ctx.http.post(`/api/merchant-applications/${id}/submit`).set(auth(sales)).expect(409);

    // Reviewer must be assigned before deciding
    await ctx.http
      .post(`/api/merchant-applications/${id}/decision`)
      .set(auth(reviewer))
      .send({ decision: 'APPROVE' })
      .expect(403);
    await ctx.http
      .put(`/api/merchant-applications/${id}/reviewer`)
      .set(auth(admin))
      .send({ reviewerId: reviewer.id })
      .expect(200);

    // REQUEST_INFO needs a reason
    await ctx.http
      .post(`/api/merchant-applications/${id}/decision`)
      .set(auth(reviewer))
      .send({ decision: 'REQUEST_INFO' })
      .expect(422);
    const infoRequested = await ctx.http
      .post(`/api/merchant-applications/${id}/decision`)
      .set(auth(reviewer))
      .send({ decision: 'REQUEST_INFO', reason: 'Please confirm expected volume' })
      .expect(200);
    expect(infoRequested.body.status).toBe('INFO_REQUESTED');

    // Sales fixes the data and resubmits; a second risk review runs
    await ctx.http
      .patch(`/api/merchant-applications/${id}`)
      .set(auth(sales))
      .send({ processing: { expectedMonthlyVolumeMinor: 3000000 } })
      .expect(200);
    const resubmitted = await submitAndAwaitRisk(ctx, sales, admin, id);
    expect(resubmitted).toMatchObject({ submissionCount: 2, decision: null });

    // Approve -> terminal
    const approved = await ctx.http
      .post(`/api/merchant-applications/${id}/decision`)
      .set(auth(reviewer))
      .send({ decision: 'APPROVE' })
      .expect(200);
    expect(approved.body).toMatchObject({
      status: 'APPROVED',
      decision: 'APPROVE',
      decidedById: reviewer.id,
    });

    // Terminal: no further decisions or re-assignment
    await ctx.http
      .post(`/api/merchant-applications/${id}/decision`)
      .set(auth(reviewer))
      .send({ decision: 'REJECT', reason: 'Changed my mind' })
      .expect(409);
    await ctx.http
      .put(`/api/merchant-applications/${id}/reviewer`)
      .set(auth(admin))
      .send({ reviewerId: reviewer.id })
      .expect(409);

    // Two risk assessments, one per submission
    const assessments = await ctx.dataSource.query(
      'SELECT submission_number FROM risk_assessments WHERE application_id = $1 ORDER BY submission_number',
      [id],
    );
    expect(assessments).toEqual([{ submission_number: 1 }, { submission_number: 2 }]);

    // Audit trail covers creation, assignment and decisions
    const audit = await ctx.http
      .get(`/api/audit-logs?entityId=${id}&pageSize=50`)
      .set(auth(admin))
      .expect(200);
    const actions = audit.body.items.map((item: { action: string }) => item.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'APPLICATION_CREATED',
        'APPLICATION_UPDATED',
        'APPLICATION_SUBMITTED',
        'RISK_REVIEW_COMPLETED',
        'REVIEWER_ASSIGNED',
        'REVIEW_DECISION_RECORDED',
      ]),
    );
    expect(
      audit.body.items.every(
        (item: { correlationId: string | null }) => item.correlationId !== undefined,
      ),
    ).toBe(true);
  });

  it('rejects without a reason (422) and with a reason (200)', async () => {
    const id = await createApplication(ctx, sales);
    await submitAndAwaitRisk(ctx, sales, admin, id);
    await ctx.http
      .put(`/api/merchant-applications/${id}/reviewer`)
      .set(auth(admin))
      .send({ reviewerId: reviewer.id })
      .expect(200);
    await ctx.http
      .post(`/api/merchant-applications/${id}/decision`)
      .set(auth(reviewer))
      .send({ decision: 'REJECT' })
      .expect(422);
    const rejected = await ctx.http
      .post(`/api/merchant-applications/${id}/decision`)
      .set(auth(reviewer))
      .send({ decision: 'REJECT', reason: 'Business could not be verified' })
      .expect(200);
    expect(rejected.body.status).toBe('REJECTED');
  });

  it('requires a justification to approve a HIGH risk merchant', async () => {
    const id = await createApplication(ctx, sales, {
      processing: {
        merchantCategoryCode: '7995',
        currency: 'USD',
        expectedMonthlyVolumeMinor: 200000000,
        averageTicketMinor: 4500,
        salesChannel: 'CARD_NOT_PRESENT',
      },
    });
    const reviewed = await submitAndAwaitRisk(ctx, sales, admin, id);
    expect(reviewed.riskLevel).toBe('HIGH');
    await ctx.http
      .put(`/api/merchant-applications/${id}/reviewer`)
      .set(auth(admin))
      .send({ reviewerId: reviewer.id })
      .expect(200);

    const assessment = await ctx.http
      .get(`/api/merchant-applications/${id}/risk-assessment`)
      .set(auth(reviewer))
      .expect(200);
    expect(assessment.body.reasons).toEqual([
      'HIGH_RISK_MCC',
      'HIGH_MONTHLY_VOLUME',
      'CARD_NOT_PRESENT',
    ]);
    expect(assessment.body).not.toHaveProperty('idempotencyKey');

    await ctx.http
      .post(`/api/merchant-applications/${id}/decision`)
      .set(auth(reviewer))
      .send({ decision: 'APPROVE' })
      .expect(422);
    await ctx.http
      .post(`/api/merchant-applications/${id}/decision`)
      .set(auth(reviewer))
      .send({ decision: 'APPROVE', reason: 'Enhanced due diligence completed' })
      .expect(200);
  });

  it('validates input and rejects inconsistent processing data', async () => {
    await ctx.http
      .post('/api/merchant-applications')
      .set(auth(sales))
      .send({ businessName: 'x' })
      .expect(400);
    const response = await ctx.http
      .post('/api/merchant-applications')
      .set(auth(sales))
      .send({
        businessName: 'Odd Shop',
        legalBusinessName: 'Odd Shop LLC',
        businessType: 'LLC',
        taxId: '00-0001111',
        owner: { fullName: 'Test Owner', email: 'owner@example.test', phone: '+15555550100' },
        processing: {
          merchantCategoryCode: '5812',
          currency: 'USD',
          expectedMonthlyVolumeMinor: 1000,
          averageTicketMinor: 5000,
          salesChannel: 'CARD_PRESENT',
        },
      })
      .expect(422);
    expect(response.body.message).toContain('Average ticket');
  });

  it('lists with status filter and pagination', async () => {
    const lister = await ctx.createUser(Role.SALES, 'lister');
    for (let i = 0; i < 3; i += 1) {
      await createApplication(ctx, lister, { businessName: `Shop ${i}` });
    }
    const submittedId = await createApplication(ctx, lister, { businessName: 'Submitted Shop' });
    await ctx.http
      .post(`/api/merchant-applications/${submittedId}/submit`)
      .set(auth(lister))
      .expect(202);

    const page1 = await ctx.http
      .get('/api/merchant-applications?status=DRAFT&page=1&pageSize=2')
      .set(auth(lister))
      .expect(200);
    expect(page1.body).toMatchObject({ page: 1, pageSize: 2, totalItems: 3, totalPages: 2 });
    expect(page1.body.items).toHaveLength(2);

    const page2 = await ctx.http
      .get('/api/merchant-applications?status=DRAFT&page=2&pageSize=2')
      .set(auth(lister))
      .expect(200);
    expect(page2.body.items).toHaveLength(1);

    const all = await ctx.http.get('/api/merchant-applications').set(auth(lister)).expect(200);
    expect(all.body.totalItems).toBe(4);

    await ctx.http.get('/api/merchant-applications?pageSize=1000').set(auth(lister)).expect(400);
    await ctx.http.get('/api/merchant-applications?status=NOPE').set(auth(lister)).expect(400);
  });

  it('stores the tax id encrypted at rest', async () => {
    const id = await createApplication(ctx, sales, { taxId: '00-0004321' });
    const [row] = await ctx.dataSource.query(
      'SELECT tax_id_encrypted, tax_id_last4 FROM merchant_applications WHERE id = $1',
      [id],
    );
    expect(row.tax_id_encrypted).not.toContain('0004321');
    expect(row.tax_id_encrypted.startsWith('v1.')).toBe(true);
    expect(row.tax_id_last4).toBe('4321');
  });

  it('a reviewer sees submitted applications but not drafts in the list', async () => {
    const draftId = await createApplication(ctx, sales, { businessName: 'Hidden Draft' });
    const response = await waitFor(
      () => ctx.http.get('/api/merchant-applications?pageSize=100').set(auth(reviewer)),
      (res) => res.status === 200,
    );
    const ids = response.body.items.map((item: { id: string }) => item.id);
    expect(ids).not.toContain(draftId);
    expect(response.body.items.every((item: { status: string }) => item.status !== 'DRAFT')).toBe(
      true,
    );
    expect((await getAsAdmin(ctx, admin, draftId)).status).toBe('DRAFT');
  });
});
