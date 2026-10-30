import { Role } from '../src/shared/domain/role.enum';
import { prepareUnderReview } from './support/lifecycle-helpers';
import { TestContext, TestUser, auth, createTestContext } from './support/test-app';

// The merchant portal end to end over real HTTP: onboarding on approval, the forced password
// change, the merchant's team, catalogue and discounts, every payment method, idempotency,
// fraud review, loyalty points, reports and tenant isolation.

const NEW_PASSWORD = 'MerchantPass2026';
const VISA = '4242 4242 4242 4242';
const DECLINED_CARD = '4000000000000002';

interface Session {
  id: string;
  token: string;
}

interface ProductBody {
  id: string;
  price: { listPriceMinor: number; discountPercent: number; discountMinor: number; finalPriceMinor: number };
}

describe('Merchant portal (e2e)', () => {
  let ctx: TestContext;
  let admin: TestUser;
  let reviewer: TestUser;
  let sales: TestUser;
  let owner: Session;
  let ownerEmail: string;
  let keyCounter = 0;

  const bearer = (session: Session) => ({ Authorization: `Bearer ${session.token}` });
  const key = () => `test-key-${Date.now()}-${++keyCounter}`;

  async function signIn(email: string, password: string): Promise<Session> {
    const response = await ctx.http.post('/api/auth/login').send({ email, password }).expect(200);
    const me = await ctx.http
      .get('/api/users/me')
      .set({ Authorization: `Bearer ${response.body.accessToken}` })
      .expect(200);
    return { id: me.body.id, token: response.body.accessToken };
  }

  // Approves a fresh application and signs the new owner in with a real password.
  async function onboardMerchant(): Promise<{ owner: Session; email: string; merchantId: string }> {
    const applicationId = await prepareUnderReview(ctx, sales, admin, reviewer);
    const decision = await ctx.http
      .post(`/api/merchant-applications/${applicationId}/decision`)
      .set(auth(reviewer))
      .send({ decision: 'APPROVE' })
      .expect(200);
    const { ownerEmail: email, temporaryPassword, merchantId } = decision.body.onboarding;
    const temporary = await signIn(email, temporaryPassword);
    await ctx.http
      .post('/api/auth/change-password')
      .set(bearer(temporary))
      .send({ currentPassword: temporaryPassword, newPassword: NEW_PASSWORD })
      .expect(204);
    return { owner: await signIn(email, NEW_PASSWORD), email, merchantId };
  }

  async function addMember(role: Role, label: string): Promise<Session> {
    const email = `${label}.${Date.now()}@shop.example.test`;
    const created = await ctx.http
      .post('/api/merchant/users')
      .set(bearer(owner))
      .send({ email, fullName: `Shop ${label}`, role })
      .expect(201);
    const temporary = await signIn(email, created.body.temporaryPassword);
    await ctx.http
      .post('/api/auth/change-password')
      .set(bearer(temporary))
      .send({ currentPassword: created.body.temporaryPassword, newPassword: NEW_PASSWORD })
      .expect(204);
    return signIn(email, NEW_PASSWORD);
  }

  async function createProduct(body: Record<string, unknown>): Promise<ProductBody> {
    const response = await ctx.http.post('/api/merchant/products').set(bearer(owner)).send(body).expect(201);
    return response.body;
  }

  function pay(session: Session, body: Record<string, unknown>, idempotencyKey = key()) {
    return ctx.http.post('/api/merchant/payments').set(bearer(session)).set('Idempotency-Key', idempotencyKey).send(body);
  }

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await ctx.createUser(Role.ADMIN);
    reviewer = await ctx.createUser(Role.REVIEWER);
    sales = await ctx.createUser(Role.SALES);
    ({ owner, email: ownerEmail } = await onboardMerchant());
  });

  afterAll(() => ctx.close());

  describe('onboarding', () => {
    it('opens the merchant with its owner as merchant admin when the application is approved', async () => {
      const profile = await ctx.http.get('/api/merchant/profile').set(bearer(owner)).expect(200);
      expect(profile.body).toMatchObject({
        tradingName: 'Test Coffee',
        currency: 'USD',
        status: 'ACTIVE',
        acceptedMethods: { cash: true, card: true, bankTransfer: true, qr: false },
      });
      const me = await ctx.http.get('/api/users/me').set(bearer(owner)).expect(200);
      expect(me.body).toMatchObject({ role: 'MERCHANT_ADMIN', email: ownerEmail, mustChangePassword: false });
    });

    it('allows nothing but changing the temporary password until it is changed', async () => {
      const applicationId = await prepareUnderReview(ctx, sales, admin, reviewer);
      const decision = await ctx.http
        .post(`/api/merchant-applications/${applicationId}/decision`)
        .set(auth(reviewer))
        .send({ decision: 'APPROVE' })
        .expect(200);
      const { ownerEmail: email, temporaryPassword } = decision.body.onboarding;
      expect(temporaryPassword).toMatch(/^(?=.*[A-Za-z])(?=.*\d).{12,}$/);

      const temporary = await signIn(email, temporaryPassword);
      const me = await ctx.http.get('/api/users/me').set(bearer(temporary)).expect(200);
      expect(me.body.mustChangePassword).toBe(true);
      const blocked = await ctx.http.get('/api/merchant/profile').set(bearer(temporary)).expect(403);
      expect(blocked.body.error).toBe('PASSWORD_CHANGE_REQUIRED');

      await ctx.http
        .post('/api/auth/change-password')
        .set(bearer(temporary))
        .send({ currentPassword: 'wrong-password-1', newPassword: NEW_PASSWORD })
        .expect(401);
      await ctx.http
        .post('/api/auth/change-password')
        .set(bearer(temporary))
        .send({ currentPassword: temporaryPassword, newPassword: NEW_PASSWORD })
        .expect(204);
      await ctx.http.get('/api/merchant/profile').set(bearer(temporary)).expect(200);
    });

    it('lets a platform admin onboard an application approved earlier only once', async () => {
      const merchants = await ctx.http.get('/api/merchants').set(auth(admin)).expect(200);
      const { applicationId } = merchants.body.items[0];
      await ctx.http.post(`/api/merchant-applications/${applicationId}/onboarding`).set(auth(admin)).expect(409);
      const merchant = await ctx.http.get(`/api/merchants/by-application/${applicationId}`).set(auth(admin)).expect(200);
      expect(merchant.body.owner).toMatchObject({ isActive: true });

      const reset = await ctx.http
        .post(`/api/merchants/${merchant.body.id}/owner/temporary-password`)
        .set(auth(admin))
        .expect(201);
      expect(reset.body.temporaryPassword).toEqual(expect.any(String));
    });

    it('keeps platform and merchant areas apart', async () => {
      await ctx.http.get('/api/merchant/profile').set(auth(admin)).expect(403);
      await ctx.http.get('/api/merchant-applications').set(bearer(owner)).expect(403);
      await ctx.http.get('/api/merchants').set(bearer(owner)).expect(403);
      await ctx.http.get('/api/users').set(bearer(owner)).expect(403);
    });
  });

  describe('team', () => {
    it('lets the merchant admin add staff who must change their password, within their merchant only', async () => {
      const cashier = await addMember(Role.MERCHANT_SALES, 'cashier');
      const team = await ctx.http.get('/api/merchant/users').set(bearer(owner)).expect(200);
      expect(team.body.items.map((user: { role: string }) => user.role).sort()).toEqual(
        expect.arrayContaining(['MERCHANT_ADMIN', 'MERCHANT_SALES']),
      );
      // Sales staff cannot manage the team or the catalogue.
      await ctx.http.get('/api/merchant/users').set(bearer(cashier)).expect(403);
      await ctx.http.post('/api/merchant/products').set(bearer(cashier)).send({ name: 'x', sku: 'x', priceMinor: 1 }).expect(403);
      // Platform roles cannot be granted from the portal.
      await ctx.http
        .post('/api/merchant/users')
        .set(bearer(owner))
        .send({ email: 'boss@shop.example.test', fullName: 'Boss', role: 'ADMIN' })
        .expect(400);
    });
  });

  describe('catalogue and discounts', () => {
    it('applies the product discount, else the category discount, and shows both prices', async () => {
      const category = await ctx.http
        .post('/api/merchant/categories')
        .set(bearer(owner))
        .send({ name: 'Pastries', discountPercent: 10 })
        .expect(201);
      const plain = await createProduct({ name: 'Croissant', sku: 'cro-1', priceMinor: 400, categoryId: category.body.id });
      const ownDiscount = await createProduct({
        name: 'Danish',
        sku: 'dan-1',
        priceMinor: 500,
        categoryId: category.body.id,
        discountPercent: 20,
      });
      expect(plain.price).toEqual({ listPriceMinor: 400, discountPercent: 10, discountMinor: 40, finalPriceMinor: 360 });
      expect(ownDiscount.price).toMatchObject({ discountPercent: 20, finalPriceMinor: 400 });
      await ctx.http
        .post('/api/merchant/products')
        .set(bearer(owner))
        .send({ name: 'Another', sku: 'CRO-1', priceMinor: 100 })
        .expect(409);
    });
  });

  describe('payments', () => {
    let coffee: ProductBody;

    beforeAll(async () => {
      coffee = await createProduct({ name: 'Flat white', sku: 'fw-1', priceMinor: 450 });
    });

    it('requires the customer for cash, gives change and awards points', async () => {
      await pay(owner, { items: [{ productId: coffee.id, quantity: 2 }], method: 'CASH', cashTenderedMinor: 1000 }).expect(422);

      const paid = await pay(owner, {
        items: [{ productId: coffee.id, quantity: 30 }],
        method: 'CASH',
        cashTenderedMinor: 15000,
        customer: { phone: '+9779812345678', fullName: 'Sita Tamang' },
      }).expect(201);
      expect(paid.body).toMatchObject({
        status: 'COMPLETED',
        totalMinor: 13500,
        changeMinor: 1500,
        pointsEarned: 1,
        customer: { name: 'Sita Tamang', phone: '+9779812345678' },
      });

      const lookup = await ctx.http
        .get('/api/merchant/customers/lookup')
        .query({ phone: '+977 981 234 5678' })
        .set(bearer(owner))
        .expect(200);
      expect(lookup.body.customer).toMatchObject({ pointsBalance: 1, visitCount: 1, totalSpentMinor: 13500 });
    });

    it('redeems points as a discount and records it in the ledger', async () => {
      const customer = await ctx.http.get('/api/merchant/customers/lookup').query({ phone: '+9779812345678' }).set(bearer(owner));
      const paid = await pay(owner, {
        items: [{ productId: coffee.id, quantity: 1 }],
        method: 'CASH',
        cashTenderedMinor: 500,
        customer: { phone: '+9779812345678' },
        pointsToRedeem: 1,
      }).expect(201);
      expect(paid.body).toMatchObject({ subtotalMinor: 450, pointsRedeemed: 1, pointsDiscountMinor: 100, totalMinor: 350 });

      const ledger = await ctx.http
        .get(`/api/merchant/customers/${customer.body.customer.id}/points`)
        .set(bearer(owner))
        .expect(200);
      expect(ledger.body.items.map((entry: { type: string }) => entry.type)).toEqual(['REDEEM', 'EARN']);

      await pay(owner, {
        items: [{ productId: coffee.id, quantity: 1 }],
        method: 'CASH',
        cashTenderedMinor: 500,
        customer: { phone: '+9779812345678' },
        pointsToRedeem: 5,
      }).expect(422);
    });

    it('takes cards without ever returning or storing the card number', async () => {
      const paid = await pay(owner, {
        items: [{ productId: coffee.id, quantity: 1 }],
        method: 'CARD',
        card: { number: VISA, expiryMonth: 12, expiryYear: 2099, cvv: '123', holderName: 'A Customer' },
      }).expect(201);
      expect(paid.body).toMatchObject({ status: 'COMPLETED', instrumentBrand: 'VISA', instrumentLast4: '4242' });
      expect(JSON.stringify(paid.body)).not.toContain('4242424242424242');

      const [row] = await ctx.dataSource.query('SELECT row_to_json(p)::text AS json FROM payment_transactions p WHERE id = $1', [paid.body.id]);
      expect(row.json).not.toContain('4242424242424242');
      expect(row.json).not.toContain('"123"');

      const declined = await pay(owner, {
        items: [{ productId: coffee.id, quantity: 1 }],
        method: 'CARD',
        card: { number: DECLINED_CARD, expiryMonth: 12, expiryYear: 2099, cvv: '123', holderName: 'A Customer' },
      }).expect(201);
      expect(declined.body).toMatchObject({ status: 'DECLINED', declineReason: 'Declined by the card issuer' });

      await pay(owner, {
        items: [{ productId: coffee.id, quantity: 1 }],
        method: 'CARD',
        card: { number: '4242 4242 4242 4241', expiryMonth: 12, expiryYear: 2099, cvv: '123', holderName: 'A Customer' },
      }).expect(422);
    });

    it('debits a bank account only with the right PIN', async () => {
      const body = (pin: string) => ({
        items: [{ productId: coffee.id, quantity: 1 }],
        method: 'BANK_TRANSFER',
        bankTransfer: { accountNumber: '0123456789012', pin },
      });
      const wrong = await pay(owner, body('1234')).expect(201);
      expect(wrong.body).toMatchObject({ status: 'DECLINED', declineReason: 'Incorrect PIN' });
      const right = await pay(owner, body('0000')).expect(201);
      expect(right.body).toMatchObject({ status: 'COMPLETED', instrumentBrand: 'BANK', instrumentLast4: '9012' });
    });

    it('refuses QR until a provider is connected', async () => {
      const response = await pay(owner, { items: [{ productId: coffee.id, quantity: 1 }], method: 'QR' }).expect(422);
      expect(response.body.message).toContain('QR payments are coming soon');
    });

    it('replays a retried request instead of charging twice', async () => {
      const idempotencyKey = key();
      const body = {
        items: [{ productId: coffee.id, quantity: 1 }],
        method: 'CARD',
        card: { number: VISA, expiryMonth: 12, expiryYear: 2099, cvv: '123', holderName: 'A Customer' },
      };
      const first = await pay(owner, body, idempotencyKey).expect(201);
      const retry = await pay(owner, body, idempotencyKey).expect(200);
      expect(retry.headers['idempotent-replayed']).toBe('true');
      expect(retry.body.id).toBe(first.body.id);

      const changed = await pay(owner, { ...body, items: [{ productId: coffee.id, quantity: 2 }] }, idempotencyKey).expect(409);
      expect(changed.body.error).toBe('IDEMPOTENCY_KEY_REUSED');
      await ctx.http.post('/api/merchant/payments').set(bearer(owner)).send(body).expect(400);
    });
  });

  describe('fraud screening and review', () => {
    let reviewerSession: Session;
    let bigTicket: ProductBody;
    let muffin: ProductBody;

    beforeAll(async () => {
      reviewerSession = await addMember(Role.MERCHANT_REVIEWER, 'reviewer');
      // Default high-value threshold is 5,000.00.
      bigTicket = await createProduct({ name: 'Espresso machine', sku: 'esp-1', priceMinor: 600_000 });
      muffin = await createProduct({ name: 'Muffin', sku: 'muf-1', priceMinor: 450 });
    });

    it('holds a high-value payment for review; approving completes it', async () => {
      const held = await pay(owner, {
        items: [{ productId: bigTicket.id, quantity: 1 }],
        method: 'BANK_TRANSFER',
        bankTransfer: { accountNumber: '5556667778', pin: '0000' },
      }).expect(201);
      expect(held.body).toMatchObject({ status: 'PENDING_REVIEW', fraud: { decision: 'REVIEW', reasons: ['HIGH_AMOUNT'] } });

      const approved = await ctx.http
        .post(`/api/merchant/payments/${held.body.id}/review`)
        .set(bearer(reviewerSession))
        .send({ approve: true, note: 'Known customer' })
        .expect(200);
      expect(approved.body).toMatchObject({ status: 'COMPLETED', review: { note: 'Known customer' } });
      await ctx.http
        .post(`/api/merchant/payments/${held.body.id}/review`)
        .set(bearer(reviewerSession))
        .send({ approve: true })
        .expect(409);
    });

    it('voids a rejected held payment and gives the reserved points back', async () => {
      const phone = '+9779800000001';
      await pay(owner, {
        items: [{ productId: muffin.id, quantity: 40 }],
        method: 'CASH',
        cashTenderedMinor: 50_000,
        customer: { phone, fullName: 'Ram Bahadur' },
      }).expect(201);
      const before = await ctx.http.get('/api/merchant/customers/lookup').query({ phone }).set(bearer(owner));
      const balance = before.body.customer.pointsBalance;
      expect(balance).toBeGreaterThan(0);

      const held = await pay(owner, {
        items: [{ productId: bigTicket.id, quantity: 1 }],
        method: 'CASH',
        cashTenderedMinor: 600_000,
        customer: { phone },
        pointsToRedeem: 1,
      }).expect(201);
      expect(held.body.status).toBe('PENDING_REVIEW');
      const during = await ctx.http.get('/api/merchant/customers/lookup').query({ phone }).set(bearer(owner));
      expect(during.body.customer.pointsBalance).toBe(balance - 1);

      const voided = await ctx.http
        .post(`/api/merchant/payments/${held.body.id}/review`)
        .set(bearer(reviewerSession))
        .send({ approve: false, note: 'Customer left' })
        .expect(200);
      expect(voided.body.status).toBe('VOIDED');
      const after = await ctx.http.get('/api/merchant/customers/lookup').query({ phone }).set(bearer(owner));
      expect(after.body.customer.pointsBalance).toBe(balance);
    });

    it('blocks a very large card payment from a new customer without calling the processor', async () => {
      const blocked = await pay(owner, {
        items: [{ productId: bigTicket.id, quantity: 3 }],
        method: 'CARD',
        customer: { phone: '+9779800000002', fullName: 'New Person' },
        card: { number: VISA, expiryMonth: 12, expiryYear: 2099, cvv: '123', holderName: 'New Person' },
      }).expect(201);
      expect(blocked.body).toMatchObject({ status: 'DECLINED', authorizationCode: null, fraud: { decision: 'BLOCK' } });
      expect(blocked.body.fraud.reasons).toEqual(
        expect.arrayContaining(['VERY_HIGH_AMOUNT', 'MANUALLY_ENTERED_CARD', 'NEW_CUSTOMER_LARGE_AMOUNT']),
      );
    });

    it('does not let sales staff review payments', async () => {
      const cashier = await addMember(Role.MERCHANT_SALES, 'cashier2');
      const list = await ctx.http.get('/api/merchant/payments').set(bearer(owner)).query({ status: 'COMPLETED' });
      await ctx.http
        .post(`/api/merchant/payments/${list.body.items[0].id}/review`)
        .set(bearer(cashier))
        .send({ approve: true })
        .expect(403);
    });
  });

  describe('history, reports and isolation', () => {
    it('shows sales staff only the payments they took', async () => {
      const cashier = await addMember(Role.MERCHANT_SALES, 'cashier3');
      const product = await createProduct({ name: 'Tea', sku: `tea-${Date.now()}`, priceMinor: 300 });
      await pay(cashier, {
        items: [{ productId: product.id, quantity: 1 }],
        method: 'CASH',
        cashTenderedMinor: 300,
        customer: { phone: '+9779800000003', fullName: 'Tea Drinker' },
      }).expect(201);
      const own = await ctx.http.get('/api/merchant/payments').set(bearer(cashier)).expect(200);
      expect(own.body.totalItems).toBe(1);
      const all = await ctx.http.get('/api/merchant/payments').set(bearer(owner)).expect(200);
      expect(all.body.totalItems).toBeGreaterThan(1);
    });

    it('reports collected money from completed payments only', async () => {
      const summary = await ctx.http
        .get('/api/merchant/reports/summary')
        .query({ tz: 'Asia/Kathmandu', days: 7 })
        .set(bearer(owner))
        .expect(200);
      const completed = await ctx.dataSource.query(
        `SELECT coalesce(sum(total_minor), 0)::bigint AS sum, count(*) AS count
         FROM payment_transactions p JOIN merchants m ON m.id = p.merchant_id
         WHERE m.contact_email = $1 AND p.status = 'COMPLETED'`,
        [ownerEmail],
      );
      expect(summary.body.allTime).toEqual({
        collectedMinor: Number(completed[0].sum),
        count: Number(completed[0].count),
      });
      expect(summary.body.today.collectedMinor).toBe(Number(completed[0].sum));
      expect(summary.body.daily).toHaveLength(7);
      expect(summary.body.byMethod.map((row: { method: string }) => row.method)).toEqual(
        expect.arrayContaining(['CASH', 'CARD', 'BANK_TRANSFER']),
      );
      expect(summary.body.declinedToday).toBeGreaterThanOrEqual(3);
    });

    it("never shows one merchant another merchant's data", async () => {
      const other = await onboardMerchant();
      const mine = await ctx.http.get('/api/merchant/payments').set(bearer(owner));
      const someone = mine.body.items[0];
      await ctx.http.get(`/api/merchant/payments/${someone.id}`).set(bearer(other.owner)).expect(404);
      const products = await ctx.http.get('/api/merchant/products').set(bearer(other.owner)).expect(200);
      expect(products.body.totalItems).toBe(0);
      const customers = await ctx.http.get('/api/merchant/customers').set(bearer(other.owner)).expect(200);
      expect(customers.body.totalItems).toBe(0);
      await pay(other.owner, { items: [{ productId: someone.lines[0].productId, quantity: 1 }], method: 'CASH' }).expect(422);
    });
  });

  describe('platform oversight', () => {
    let merchantId: string;

    beforeAll(async () => {
      merchantId = (await ctx.http.get('/api/merchant/profile').set(bearer(owner)).expect(200)).body.id;
    });

    it("lets a platform admin read a merchant's payments, sales, customers, catalogue and team", async () => {
      const base = `/api/merchants/${merchantId}`;
      const mine = await ctx.http.get('/api/merchant/payments').set(bearer(owner)).expect(200);
      const payments = await ctx.http.get(`${base}/payments`).set(auth(admin)).expect(200);
      expect(payments.body.totalItems).toBe(mine.body.totalItems);

      const payment = payments.body.items[0];
      const detail = await ctx.http.get(`${base}/payments/${payment.id}`).set(auth(admin)).expect(200);
      expect(detail.body).toMatchObject({ id: payment.id, totalMinor: payment.totalMinor });

      const summary = await ctx.http.get(`${base}/reports/summary?tz=UTC&days=7`).set(auth(admin)).expect(200);
      expect(summary.body.currency).toBe('USD');

      const customers = await ctx.http.get(`${base}/customers`).set(auth(admin)).expect(200);
      expect(customers.body.totalItems).toBeGreaterThan(0);
      const customerId = customers.body.items[0].id;
      await ctx.http.get(`${base}/customers/${customerId}`).set(auth(admin)).expect(200);
      await ctx.http.get(`${base}/customers/${customerId}/points`).set(auth(admin)).expect(200);

      const products = await ctx.http.get(`${base}/products`).set(auth(admin)).expect(200);
      expect(products.body.totalItems).toBeGreaterThan(0);
      await ctx.http.get(`${base}/categories`).set(auth(admin)).expect(200);

      const team = await ctx.http.get(`${base}/users`).set(auth(admin)).expect(200);
      expect(team.body.items.map((user: { email: string }) => user.email)).toContain(ownerEmail);
    });

    it('keeps oversight to platform admins, and to the merchant named in the URL', async () => {
      const base = `/api/merchants/${merchantId}`;
      await ctx.http.get(`${base}/payments`).set(auth(reviewer)).expect(403);
      await ctx.http.get(`${base}/customers`).set(bearer(owner)).expect(403);

      await ctx.http.get('/api/merchants/00000000-0000-4000-8000-000000000000/payments').set(auth(admin)).expect(404);

      const other = await onboardMerchant();
      const payment = (await ctx.http.get(`${base}/payments`).set(auth(admin))).body.items[0];
      await ctx.http.get(`/api/merchants/${other.merchantId}/payments/${payment.id}`).set(auth(admin)).expect(404);
    });
  });
});
