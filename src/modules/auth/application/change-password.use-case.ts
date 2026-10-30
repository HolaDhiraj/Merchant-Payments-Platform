import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../shared/domain/actor';
import {
  AuthenticationFailedError,
  BusinessRuleViolationError,
} from '../../../shared/domain/domain-errors';
import { UNIT_OF_WORK, UnitOfWork } from '../../../shared/application/unit-of-work';
import { AuditLogger } from '../../audit/application/audit-logger';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { PASSWORD_HASHER, PasswordHasher } from '../../users/domain/password-hasher';
import { USER_REPOSITORY, UserRepository } from '../../users/domain/user.repository';

export interface ChangePasswordCommand {
  currentPassword: string;
  newPassword: string;
}

// Replaces the caller's password after re-checking the current one. This is also how a
// temporary password (new merchant owners, admin resets) becomes a real one.
@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditLogger,
  ) {}

  async execute(actor: Actor, command: ChangePasswordCommand): Promise<void> {
    const user = await this.users.findById(actor.userId);
    if (!user || !(await this.passwordHasher.verify(command.currentPassword, user.passwordHash))) {
      throw new AuthenticationFailedError('Your current password is not correct');
    }
    if (command.newPassword === command.currentPassword) {
      throw new BusinessRuleViolationError('Choose a password different from the current one');
    }

    const hash = await this.passwordHasher.hash(command.newPassword);
    await this.unitOfWork.run(async () => {
      await this.users.updatePassword(user.id, hash, false);
      await this.audit.record({
        actor,
        action: AuditAction.PASSWORD_CHANGED,
        entityType: 'User',
        entityId: user.id,
        metadata: { wasTemporary: user.mustChangePassword },
      });
    });
  }
}
