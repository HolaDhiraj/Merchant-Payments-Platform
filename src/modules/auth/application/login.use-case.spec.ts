import { Role } from '../../../shared/domain/role.enum';
import { SecurityConfig } from '../../../config/app.config';
import {
  AccountDeactivatedError,
  AccountLockedError,
  AuthenticationFailedError,
} from '../../../shared/domain/domain-errors';
import { AuditLogger } from '../../audit/application/audit-logger';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { User, UserProps } from '../../users/domain/user';
import { UserRepository } from '../../users/domain/user.repository';
import { PasswordHasher } from '../../users/domain/password-hasher';
import { InMemoryAuditLogRepository } from '../../../../test/support/fakes/in-memory-repositories';
import { FixedClock, SequentialIdGenerator } from '../../../../test/support/fakes/fixed-clock';
import { TokenService } from '../domain/token-service';
import { LoginUseCase } from './login.use-case';

// Fake hasher: "hash" is the reversed password, good enough to test the flow.
const hasher: PasswordHasher = {
  hash: async (plain) => plain.split('').reverse().join(''),
  verify: jest.fn(
    async (plain: string, hash: string) => plain.split('').reverse().join('') === hash,
  ),
};

const tokens: TokenService = {
  issue: async (claims) => ({ accessToken: `token-for-${claims.sub}`, expiresInSeconds: 900 }),
  verify: async () => ({ sub: 'x', role: Role.SALES }),
};

describe('LoginUseCase', () => {
  const now = new Date();
  const activeUser = User.restore({
    id: '00000000-0000-4000-8000-000000000001',
    email: 'sales@example.test',
    fullName: 'Sales',
    role: Role.SALES,
    passwordHash: 'drowssap-tset',
    isActive: true,
    failedLoginAttempts: 0,
    lockedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  const inactiveUser = User.restore({
    ...activeUser.toJSON(),
    id: '00000000-0000-4000-8000-000000000002',
    email: 'inactive@example.test',
    passwordHash: 'drowssap-tset',
    isActive: false,
  });

  let auditLog: InMemoryAuditLogRepository;
  let useCase: LoginUseCase;
  let rows: Map<string, UserProps>;

  beforeEach(() => {
    auditLog = new InMemoryAuditLogRepository();
    // Stateful fake so the lockout counter behaves like the real UPDATE ... RETURNING.
    rows = new Map(
      [activeUser, inactiveUser].map((u) => [u.id, { ...u.toJSON(), passwordHash: u.passwordHash }]),
    );
    const users: UserRepository = {
      findById: async (id) => (rows.has(id) ? User.restore({ ...rows.get(id)! }) : null),
      findByEmail: async (email) => {
        const row = [...rows.values()].find((u) => u.email === email);
        return row ? User.restore({ ...row }) : null;
      },
      insert: async () => undefined,
      search: async () => ({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }),
      recordFailedLogin: async (id, lockAfter, at) => {
        const row = rows.get(id)!;
        row.failedLoginAttempts += 1;
        if (!row.lockedAt && row.failedLoginAttempts >= lockAfter) row.lockedAt = at;
        return { failedLoginAttempts: row.failedLoginAttempts, lockedAt: row.lockedAt };
      },
      clearLoginFailures: async (id) => {
        Object.assign(rows.get(id)!, { failedLoginAttempts: 0, lockedAt: null });
      },
      setActive: async (id, isActive) => {
        rows.get(id)!.isActive = isActive;
      },
    };
    const clock = new FixedClock();
    useCase = new LoginUseCase(
      users,
      hasher,
      tokens,
      { loginLockoutThreshold: 5 } as SecurityConfig,
      clock,
      new AuditLogger(auditLog, clock, new SequentialIdGenerator()),
    );
  });

  const wrongPassword = () => useCase.execute({ email: 'sales@example.test', password: 'nope' });
  // The use case only ever rejects with domain errors here; this narrows the type for assertions.
  const failure = (attempt: Promise<unknown>) =>
    attempt.then(
      () => {
        throw new Error('expected the sign-in to fail');
      },
      (error: AuthenticationFailedError) => error,
    );
  const rightPassword = () =>
    useCase.execute({ email: 'sales@example.test', password: 'test-password' });

  it('issues a token for valid credentials and audits the login', async () => {
    const token = await useCase.execute({ email: 'sales@example.test', password: 'test-password' });
    expect(token.accessToken).toBe(`token-for-${activeUser.id}`);
    expect(auditLog.entries[0].action).toBe(AuditAction.LOGIN_SUCCEEDED);
  });

  it.each([
    ['wrong password', 'sales@example.test', 'nope'],
    ['unknown email', 'ghost@example.test', 'test-password'],
    ['wrong password on a deactivated account', 'inactive@example.test', 'nope'],
  ])('fails with the same generic error for %s', async (_case, email, password) => {
    await expect(useCase.execute({ email, password })).rejects.toThrow(
      new AuthenticationFailedError(),
    );
  });

  it('tells a deactivated user with the right password to contact an administrator', async () => {
    await expect(
      useCase.execute({ email: 'inactive@example.test', password: 'test-password' }),
    ).rejects.toBeInstanceOf(AccountDeactivatedError);
    expect(auditLog.entries[0]).toMatchObject({
      action: AuditAction.LOGIN_FAILED,
      metadata: { reason: 'INACTIVE_USER' },
    });
  });

  it('still runs a hash comparison for unknown emails (timing-safe)', async () => {
    (hasher.verify as jest.Mock).mockClear();
    await expect(useCase.execute({ email: 'ghost@example.test', password: 'x' })).rejects.toThrow();
    expect(hasher.verify).toHaveBeenCalledTimes(1);
  });

  it('never stores the password in the audit trail', async () => {
    await expect(
      useCase.execute({ email: 'sales@example.test', password: 'nope' }),
    ).rejects.toThrow();
    expect(JSON.stringify(auditLog.entries)).not.toContain('nope');
    expect(auditLog.entries[0].action).toBe(AuditAction.LOGIN_FAILED);
  });

  describe('lockout after repeated wrong passwords', () => {
    it('keeps the generic error while more than two attempts remain', async () => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        await expect(wrongPassword()).rejects.toEqual(new AuthenticationFailedError());
      }
    });

    it('warns with the remaining attempts once two or fewer are left', async () => {
      await wrongPassword().catch(() => undefined);
      await wrongPassword().catch(() => undefined);
      const third = await failure(wrongPassword());
      expect(third).toBeInstanceOf(AuthenticationFailedError);
      expect(third.meta).toEqual({ remainingAttempts: 2 });
      const fourth = await failure(wrongPassword());
      expect(fourth.meta).toEqual({ remainingAttempts: 1 });
      expect(fourth.message).toContain('1 attempt left');
    });

    it('locks the account on the fifth wrong password and audits it', async () => {
      for (let attempt = 1; attempt <= 4; attempt++) await wrongPassword().catch(() => undefined);
      await expect(wrongPassword()).rejects.toBeInstanceOf(AccountLockedError);
      expect(rows.get(activeUser.id)!.lockedAt).not.toBeNull();
      expect(auditLog.entries.map((e) => e.action)).toContain(AuditAction.USER_LOCKED);
    });

    it('rejects even the right password while locked, without counting further', async () => {
      for (let attempt = 1; attempt <= 5; attempt++) await wrongPassword().catch(() => undefined);
      await expect(rightPassword()).rejects.toBeInstanceOf(AccountLockedError);
      await expect(wrongPassword()).rejects.toBeInstanceOf(AccountLockedError);
      expect(rows.get(activeUser.id)!.failedLoginAttempts).toBe(5);
    });

    it('resets the counter after a successful sign-in', async () => {
      for (let attempt = 1; attempt <= 4; attempt++) await wrongPassword().catch(() => undefined);
      await rightPassword();
      expect(rows.get(activeUser.id)!.failedLoginAttempts).toBe(0);
      await expect(wrongPassword()).rejects.toEqual(new AuthenticationFailedError());
    });

    it('does not count attempts against inactive accounts', async () => {
      await useCase.execute({ email: 'inactive@example.test', password: 'nope' }).catch(() => undefined);
      expect(rows.get(inactiveUser.id)!.failedLoginAttempts).toBe(0);
    });
  });
});
