import { Role } from '../src/shared/domain/role.enum';
import { TEST_PASSWORD, TestContext, TestUser, auth, createTestContext } from './support/test-app';

describe('Authentication (e2e)', () => {
  let ctx: TestContext;
  let sales: TestUser;

  beforeAll(async () => {
    ctx = await createTestContext();
    sales = await ctx.createUser(Role.SALES);
  });

  afterAll(() => ctx.close());

  it('issues a bearer token for valid credentials', async () => {
    const response = await ctx.http
      .post('/auth/login')
      .send({ email: sales.email, password: TEST_PASSWORD })
      .expect(200);
    expect(response.body).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    expect(response.body.accessToken.split('.')).toHaveLength(3);
  });

  it('returns the same generic 401 for wrong password and unknown email', async () => {
    const wrongPassword = await ctx.http
      .post('/auth/login')
      .send({ email: sales.email, password: 'wrong-password-1' })
      .expect(401);
    const unknownEmail = await ctx.http
      .post('/auth/login')
      .send({ email: 'nobody@example.test', password: 'wrong-password-1' })
      .expect(401);
    expect(wrongPassword.body.message).toBe('Invalid credentials');
    expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
  });

  it('rejects requests without a token', async () => {
    await ctx.http.get('/merchant-applications').expect(401);
  });

  it('rejects a tampered token', async () => {
    const [header, payload] = sales.token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
        role: 'ADMIN',
      }),
    ).toString('base64url');
    await ctx.http
      .get('/merchant-applications')
      .set({ Authorization: `Bearer ${header}.${forgedPayload}.invalidsignature` })
      .expect(401);
  });

  it('rejects the token of a user who was deactivated after login', async () => {
    const user = await ctx.createUser(Role.SALES, 'deactivated');
    await ctx.http.get('/merchant-applications').set(auth(user)).expect(200);
    await ctx.dataSource.query('UPDATE users SET is_active = false WHERE id = $1', [user.id]);
    await ctx.http.get('/merchant-applications').set(auth(user)).expect(401);
  });

  it('keeps /health public', async () => {
    await ctx.http.get('/health').expect(200, { status: 'ok', database: 'up', redis: 'up' });
  });

  it('never writes passwords or tokens to the audit trail', async () => {
    const rows: Array<{ metadata: unknown }> = await ctx.dataSource.query(
      'SELECT metadata FROM audit_logs',
    );
    const dump = JSON.stringify(rows);
    expect(dump).not.toContain(TEST_PASSWORD);
    expect(dump).not.toContain(sales.token);
  });

  it('returns a correlation id on every response', async () => {
    const response = await ctx.http.get('/health').expect(200);
    expect(response.headers['x-correlation-id']).toBeDefined();
  });
});
