import { Role } from '../../../shared/domain/role.enum';
import { AuthenticationFailedError } from '../../../shared/domain/domain-errors';
import { AuditLogger } from '../../audit/application/audit-logger';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { User } from '../../users/domain/user';
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

  beforeEach(() => {
    auditLog = new InMemoryAuditLogRepository();
    const users: UserRepository = {
      findById: async () => null,
      findByEmail: async (email) =>
        [activeUser, inactiveUser].find((u) => u.email === email) ?? null,
      insert: async () => undefined,
      search: async () => ({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }),
    };
    useCase = new LoginUseCase(
      users,
      hasher,
      tokens,
      new AuditLogger(auditLog, new FixedClock(), new SequentialIdGenerator()),
    );
  });

  it('issues a token for valid credentials and audits the login', async () => {
    const token = await useCase.execute({ email: 'sales@example.test', password: 'test-password' });
    expect(token.accessToken).toBe(`token-for-${activeUser.id}`);
    expect(auditLog.entries[0].action).toBe(AuditAction.LOGIN_SUCCEEDED);
  });

  it.each([
    ['wrong password', 'sales@example.test', 'nope'],
    ['unknown email', 'ghost@example.test', 'test-password'],
    ['inactive user', 'inactive@example.test', 'test-password'],
  ])('fails with the same generic error for %s', async (_case, email, password) => {
    await expect(useCase.execute({ email, password })).rejects.toThrow(
      new AuthenticationFailedError(),
    );
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
});
