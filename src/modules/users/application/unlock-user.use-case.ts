import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../shared/domain/actor';
import {
  BusinessRuleViolationError,
  EntityNotFoundError,
} from '../../../shared/domain/domain-errors';
import { UNIT_OF_WORK, UnitOfWork } from '../../../shared/application/unit-of-work';
import { AuditLogger } from '../../audit/application/audit-logger';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { User } from '../domain/user';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository';

// Lifts a sign-in lockout (ADMIN only, enforced at the controller) and resets the failure count.
@Injectable()
export class UnlockUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditLogger,
  ) {}

  async execute(actor: Actor, userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new EntityNotFoundError('User', userId);
    }
    if (!user.isLocked) {
      throw new BusinessRuleViolationError('This account is not locked');
    }

    await this.unitOfWork.run(async () => {
      await this.users.clearLoginFailures(user.id);
      await this.audit.record({
        actor,
        action: AuditAction.USER_UNLOCKED,
        entityType: 'User',
        entityId: user.id,
        metadata: { failedAttempts: user.failedLoginAttempts },
      });
    });

    return (await this.users.findById(user.id)) as User;
  }
}
