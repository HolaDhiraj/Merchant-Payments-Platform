import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { AuthenticationFailedError } from '../../../shared/domain/domain-errors';
import { AuditLogger } from '../../audit/application/audit-logger';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { USER_REPOSITORY, UserRepository } from '../../users/domain/user.repository';
import { PASSWORD_HASHER, PasswordHasher } from '../../users/domain/password-hasher';
import { IssuedToken, TOKEN_SERVICE, TokenService } from '../domain/token-service';

export interface LoginCommand {
  email: string;
  password: string;
}

// Exchanges valid credentials for a short-lived access token.
// The same generic error is returned for unknown email, wrong password and inactive users,
// and a hash comparison always runs, so attackers cannot enumerate accounts by timing.
@Injectable()
export class LoginUseCase {
  private dummyHash?: Promise<string>;

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    private readonly audit: AuditLogger,
  ) {}

  async execute(command: LoginCommand): Promise<IssuedToken> {
    const user = await this.users.findByEmail(command.email);
    const hashToCheck = user?.passwordHash ?? (await this.getDummyHash());
    const passwordMatches = await this.passwordHasher.verify(command.password, hashToCheck);

    if (!user || !passwordMatches || !user.isActive) {
      if (user) {
        await this.audit.record({
          actor: null,
          action: AuditAction.LOGIN_FAILED,
          entityType: 'User',
          entityId: user.id,
          metadata: { reason: user.isActive ? 'INVALID_PASSWORD' : 'INACTIVE_USER' },
        });
      }
      throw new AuthenticationFailedError();
    }

    await this.audit.record({
      actor: { userId: user.id, role: user.role },
      action: AuditAction.LOGIN_SUCCEEDED,
      entityType: 'User',
      entityId: user.id,
    });

    return this.tokens.issue({ sub: user.id, role: user.role });
  }

  // Hash of a random value, created once, used to keep timing constant for unknown emails.
  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.passwordHasher.hash(randomBytes(16).toString('hex'));
    return this.dummyHash;
  }
}
