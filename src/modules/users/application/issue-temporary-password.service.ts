import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../shared/domain/actor';
import { generateTemporaryPassword } from '../../../shared/security/temporary-password';
import { AuditLogger } from '../../audit/application/audit-logger';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { PASSWORD_HASHER, PasswordHasher } from '../domain/password-hasher';
import { User } from '../domain/user';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository';

// Replaces a user's password with a one-time one (forgotten password, new owner hand-over).
// It also lifts any sign-in lockout. Callers decide who may do this; run it inside their unit of work.
@Injectable()
export class IssueTemporaryPasswordService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    private readonly audit: AuditLogger,
  ) {}

  async issue(actor: Actor, user: User): Promise<string> {
    const temporaryPassword = generateTemporaryPassword();
    await this.users.updatePassword(user.id, await this.passwordHasher.hash(temporaryPassword), true);
    await this.users.clearLoginFailures(user.id);
    await this.audit.record({
      actor,
      action: AuditAction.TEMPORARY_PASSWORD_ISSUED,
      entityType: 'User',
      entityId: user.id,
      metadata: { merchantId: user.merchantId },
    });
    return temporaryPassword;
  }
}
