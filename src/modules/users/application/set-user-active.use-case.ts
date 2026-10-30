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

// Activates or deactivates an account (ADMIN only, enforced at the controller).
// A deactivated user cannot sign in, and their existing tokens stop working on the next request.
// Setting the status it already has is a no-op, so the call is safe to retry.
@Injectable()
export class SetUserActiveUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditLogger,
  ) {}

  async execute(actor: Actor, userId: string, isActive: boolean): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new EntityNotFoundError('User', userId);
    }
    // Keeps at least one admin able to sign in, and stops an admin locking themselves out.
    if (!isActive && user.id === actor.userId) {
      throw new BusinessRuleViolationError('You cannot deactivate your own account');
    }
    if (user.isActive === isActive) {
      return user;
    }

    await this.unitOfWork.run(async () => {
      await this.users.setActive(user.id, isActive);
      await this.audit.record({
        actor,
        action: isActive ? AuditAction.USER_ACTIVATED : AuditAction.USER_DEACTIVATED,
        entityType: 'User',
        entityId: user.id,
        metadata: { email: user.email, role: user.role },
      });
    });

    return (await this.users.findById(user.id)) as User;
  }
}
