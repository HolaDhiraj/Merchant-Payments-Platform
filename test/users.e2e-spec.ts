import { Role } from '../src/shared/domain/role.enum';
import { TEST_PASSWORD, TestContext, TestUser, auth, createTestContext } from './support/test-app';

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

  describe('sign-in lockout', () => {
    const signIn = (email: string, password: string) =>
      ctx.http.post('/api/auth/login').send({ email, password });

    it('warns before locking, locks after five wrong passwords and lets only an admin unlock', async () => {
      const target = await ctx.createUser(Role.SALES, 'lockout');

      for (let attempt = 1; attempt <= 2; attempt++) {
        const response = await signIn(target.email, 'wrong-password-1').expect(401);
        expect(response.body.meta).toBeUndefined();
      }
      const third = await signIn(target.email, 'wrong-password-1').expect(401);
      expect(third.body.meta).toEqual({ remainingAttempts: 2 });
      const fourth = await signIn(target.email, 'wrong-password-1').expect(401);
      expect(fourth.body.meta).toEqual({ remainingAttempts: 1 });

      const fifth = await signIn(target.email, 'wrong-password-1').expect(423);
      expect(fifth.body).toMatchObject({ error: 'ACCOUNT_LOCKED' });
      expect(fifth.body.message).toContain('Contact an administrator');

      // Locked means locked, even with the right password.
      await signIn(target.email, TEST_PASSWORD).expect(423);

      const listed = await ctx.http.get('/api/users?pageSize=100').set(auth(admin)).expect(200);
      const row = listed.body.items.find((u: { id: string }) => u.id === target.id);
      expect(row).toMatchObject({ isLocked: true });
      expect(row.lockedAt).toEqual(expect.any(String));

      await ctx.http.post(`/api/users/${target.id}/unlock`).set(auth(reviewer)).expect(403);
      const unlocked = await ctx.http
        .post(`/api/users/${target.id}/unlock`)
        .set(auth(admin))
        .expect(200);
      expect(unlocked.body).toMatchObject({ id: target.id, isLocked: false, lockedAt: null });
      await ctx.http.post(`/api/users/${target.id}/unlock`).set(auth(admin)).expect(422);

      await signIn(target.email, TEST_PASSWORD).expect(200);
      const actions: Array<{ action: string }> = await ctx.dataSource.query(
        `SELECT action FROM audit_logs WHERE entity_id = $1 AND action IN ('USER_LOCKED', 'USER_UNLOCKED')`,
        [target.id],
      );
      expect(actions.map((a) => a.action).sort()).toEqual(['USER_LOCKED', 'USER_UNLOCKED']);
    });

    it('resets the counter after a successful sign-in', async () => {
      const target = await ctx.createUser(Role.SALES, 'reset');
      for (let attempt = 1; attempt <= 4; attempt++) {
        await signIn(target.email, 'wrong-password-1').expect(401);
      }
      await signIn(target.email, TEST_PASSWORD).expect(200);
      const next = await signIn(target.email, 'wrong-password-1').expect(401);
      expect(next.body.meta).toBeUndefined();
    });

    it('returns 404 when unlocking an unknown user', async () => {
      await ctx.http
        .post('/api/users/00000000-0000-4000-8000-000000000999/unlock')
        .set(auth(admin))
        .expect(404);
    });
  });

  describe('activation', () => {
    const signIn = (email: string, password: string) =>
      ctx.http.post('/api/auth/login').send({ email, password });
    const setStatus = (caller: TestUser, id: string, isActive: unknown) =>
      ctx.http.patch(`/api/users/${id}/status`).set(auth(caller)).send({ isActive });

    it('deactivates an account, explains it at sign-in and lets an admin reactivate it', async () => {
      const target = await ctx.createUser(Role.SALES, 'deactivated');

      const deactivated = await setStatus(admin, target.id, false).expect(200);
      expect(deactivated.body).toMatchObject({ id: target.id, isActive: false });

      // Existing sessions end on the next request.
      await ctx.http.get('/api/users/me').set(auth(target)).expect(401);

      // Only the right password learns why; a wrong one gets the generic answer.
      const rightPassword = await signIn(target.email, TEST_PASSWORD).expect(403);
      expect(rightPassword.body).toMatchObject({ error: 'ACCOUNT_DEACTIVATED' });
      expect(rightPassword.body.message).toContain('Contact an administrator');
      const wrongPassword = await signIn(target.email, 'wrong-password-1').expect(401);
      expect(wrongPassword.body).toMatchObject({ error: 'AUTHENTICATION_FAILED' });
      expect(wrongPassword.body.meta).toBeUndefined();

      const reactivated = await setStatus(admin, target.id, true).expect(200);
      expect(reactivated.body).toMatchObject({ id: target.id, isActive: true });
      await signIn(target.email, TEST_PASSWORD).expect(200);

      const actions: Array<{ action: string }> = await ctx.dataSource.query(
        `SELECT action FROM audit_logs WHERE entity_id = $1 AND action IN ('USER_ACTIVATED', 'USER_DEACTIVATED')`,
        [target.id],
      );
      expect(actions.map((a) => a.action).sort()).toEqual(['USER_ACTIVATED', 'USER_DEACTIVATED']);
    });

    it('treats setting the current status as a no-op', async () => {
      const target = await ctx.createUser(Role.SALES, 'noop');
      await setStatus(admin, target.id, true).expect(200);
      const rows: Array<{ count: string }> = await ctx.dataSource.query(
        `SELECT count(*) FROM audit_logs WHERE entity_id = $1 AND action = 'USER_ACTIVATED'`,
        [target.id],
      );
      expect(Number(rows[0].count)).toBe(0);
    });

    it('stops an admin from deactivating their own account', async () => {
      const response = await setStatus(admin, admin.id, false).expect(422);
      expect(response.body.message).toBe('You cannot deactivate your own account');
    });

    it('is admin-only and validates the body', async () => {
      await setStatus(reviewer, sales.id, false).expect(403);
      await setStatus(sales, reviewer.id, false).expect(403);
      await setStatus(admin, sales.id, 'no').expect(400);
      await setStatus(admin, '00000000-0000-4000-8000-000000000999', false).expect(404);
    });
  });
});

