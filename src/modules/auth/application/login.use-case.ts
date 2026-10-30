import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { securityConfig, SecurityConfig } from '../../../config/app.config';
import { Clock, CLOCK } from '../../../shared/domain/clock';
import {
  AccountDeactivatedError,
  AccountLockedError,
  AuthenticationFailedError,
} from '../../../shared/domain/domain-errors';
import { AuditLogger } from '../../audit/application/audit-logger';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { User } from '../../users/domain/user';
import { USER_REPOSITORY, UserRepository } from '../../users/domain/user.repository';
import { PASSWORD_HASHER, PasswordHasher } from '../../users/domain/password-hasher';
import { IssuedToken, TOKEN_SERVICE, TokenService } from '../domain/token-service';

export interface LoginCommand {
  email: string;
  password: string;
}

// From this many attempts left, a failed sign-in tells the caller how close the lock is.
export const LOCKOUT_WARNING_REMAINING = 2;

// Exchanges valid credentials for a short-lived access token.
// The same generic error is returned for unknown email and wrong password (also on deactivated
// accounts), and a hash comparison always runs, so attackers cannot enumerate accounts by timing.
// Only the right password on a deactivated account is told that it was deactivated.
// Consecutive wrong passwords lock the account (LOGIN_LOCKOUT_THRESHOLD) until an admin unlocks it.
@Injectable()
export class LoginUseCase {
  private dummyHash?: Promise<string>;

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(securityConfig.KEY) private readonly config: SecurityConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(command: LoginCommand): Promise<IssuedToken> {
    const user = await this.users.findByEmail(command.email);
    const hashToCheck = user?.passwordHash ?? (await this.getDummyHash());
    const passwordMatches = await this.passwordHasher.verify(command.password, hashToCheck);

    if (!user) {
      throw new AuthenticationFailedError();
    }

    // Deactivated accounts never count towards the lockout; the reason is only shared
    // with someone who proved they know the password.
    if (!user.isActive) {
      await this.recordFailure(user, 'INACTIVE_USER');
      throw passwordMatches ? new AccountDeactivatedError() : new AuthenticationFailedError();
    }

    // A locked account stays locked even with the right password.
    if (user.isLocked) {
      await this.recordFailure(user, 'ACCOUNT_LOCKED');
      throw new AccountLockedError();
    }

    if (!passwordMatches) {
      throw await this.countWrongPassword(user);
    }

    if (user.failedLoginAttempts > 0) {
      await this.users.clearLoginFailures(user.id);
    }
    await this.audit.record({
      actor: { userId: user.id, role: user.role },
      action: AuditAction.LOGIN_SUCCEEDED,
      entityType: 'User',
      entityId: user.id,
    });

    return this.tokens.issue({ sub: user.id, role: user.role });
  }

  // Counts the wrong password and returns the error to throw: locked, a warning, or generic.
  private async countWrongPassword(user: User): Promise<Error> {
    const threshold = this.config.loginLockoutThreshold;
    const state = await this.users.recordFailedLogin(user.id, threshold, this.clock.now());
    await this.recordFailure(user, 'INVALID_PASSWORD', { failedAttempts: state.failedLoginAttempts });

    if (state.lockedAt) {
      await this.audit.record({
        actor: null,
        action: AuditAction.USER_LOCKED,
        entityType: 'User',
        entityId: user.id,
        metadata: { failedAttempts: state.failedLoginAttempts },
      });
      return new AccountLockedError();
    }

    const remainingAttempts = threshold - state.failedLoginAttempts;
    if (remainingAttempts > LOCKOUT_WARNING_REMAINING) {
      return new AuthenticationFailedError();
    }
    const plural = remainingAttempts === 1 ? 'attempt' : 'attempts';
    return new AuthenticationFailedError(
      `Invalid credentials. ${remainingAttempts} ${plural} left before the account is locked.`,
      { remainingAttempts },
    );
  }

  private recordFailure(user: User, reason: string, extra: Record<string, unknown> = {}) {
    return this.audit.record({
      actor: null,
      action: AuditAction.LOGIN_FAILED,
      entityType: 'User',
      entityId: user.id,
      metadata: { reason, ...extra },
    });
  }

  // Hash of a random value, created once, used to keep timing constant for unknown emails.
  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.passwordHasher.hash(randomBytes(16).toString('hex'));
    return this.dummyHash;
  }
}
