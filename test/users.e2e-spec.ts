import { Role } from '../src/shared/domain/role.enum';
import { TestContext, TestUser, auth, createTestContext } from './support/test-app';

describe('Users (e2e)', () => {
  let ctx: TestContext;
  let admin: TestUser;
  let reviewer: TestUser;
  let sales: TestUser;

  beforeAll(async () => {
    ctx = await createTestContext();
    admin = await ctx.createUser(Role.ADMIN);
    reviewer = await ctx.createUser(Role.REVIEWER);
    sales = await ctx.createUser(Role.SALES);
  });

  afterAll(() => ctx.close());

  it('returns the profile of the caller without the password hash', async () => {
    const response = await ctx.http.get('/api/users/me').set(auth(sales)).expect(200);
    expect(response.body).toMatchObject({ id: sales.id, email: sales.email, role: Role.SALES });
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('requires a token to read the profile', async () => {
    await ctx.http.get('/api/users/me').expect(401);
  });

  it('lets an admin list users filtered by role', async () => {
    const response = await ctx.http
      .get('/api/users?role=REVIEWER')
      .set(auth(admin))
      .expect(200);
    expect(response.body.totalItems).toBe(1);
    expect(response.body.items[0]).toMatchObject({ id: reviewer.id, role: Role.REVIEWER });
  });

  it('forbids non-admins from listing users', async () => {
    await ctx.http.get('/api/users').set(auth(reviewer)).expect(403);
    await ctx.http.get('/api/users').set(auth(sales)).expect(403);
  });
});
