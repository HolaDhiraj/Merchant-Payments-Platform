import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../shared/domain/actor';
import {
  BusinessRuleViolationError,
  EntityNotFoundError,
} from '../../../shared/domain/domain-errors';
import { merchantIdOf } from '../../../shared/application/merchant-scope';
import { Page, PageRequest } from '../../../shared/application/pagination';
import { UNIT_OF_WORK, UnitOfWork } from '../../../shared/application/unit-of-work';
import { isMerchantRole, Role } from '../../../shared/domain/role.enum';
import { generateTemporaryPassword } from '../../../shared/security/temporary-password';
import { AuditLogger } from '../../audit/application/audit-logger';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { CreateUserUseCase } from '../../users/application/create-user.use-case';
import { IssueTemporaryPasswordService } from '../../users/application/issue-temporary-password.service';
import { User } from '../../users/domain/user';
import { USER_REPOSITORY, UserRepository } from '../../users/domain/user.repository';

// A merchant admin manages the people of their own merchant. Every lookup is checked against
// the caller's merchant; another merchant's user is reported as not found (no enumeration).

@Injectable()
export class MerchantTeamMemberReader {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async get(actor: Actor, userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user || user.merchantId !== merchantIdOf(actor)) {
      throw new EntityNotFoundError('User', userId);
    }
    return user;
  }
}

@Injectable()
export class ListMerchantUsersUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  execute(actor: Actor, query: { role?: Role }, page: PageRequest): Promise<Page<User>> {
    return this.forMerchant(merchantIdOf(actor), query, page);
  }

  // Platform oversight (a platform admin names the merchant; read-only).
  forMerchant(merchantId: string, query: { role?: Role }, page: PageRequest): Promise<Page<User>> {
    return this.users.search({ merchantId, role: query.role }, page);
  }
}

export interface AddMerchantUserCommand {
  email: string;
  fullName: string;
  role: Role;
}

@Injectable()
export class AddMerchantUserUseCase {
  constructor(private readonly createUser: CreateUserUseCase) {}

  // The new member gets a one-time password to change at first sign-in.
  async execute(
    actor: Actor,
    command: AddMerchantUserCommand,
  ): Promise<{ user: User; temporaryPassword: string }> {
    if (!isMerchantRole(command.role)) {
      throw new BusinessRuleViolationError('Choose a merchant role');
    }
    const temporaryPassword = generateTemporaryPassword();
    const user = await this.createUser.execute(actor, {
      ...command,
      password: temporaryPassword,
      merchantId: merchantIdOf(actor),
      mustChangePassword: true,
    });
    return { user, temporaryPassword };
  }
}

@Injectable()
export class SetMerchantUserActiveUseCase {
  constructor(
    private readonly members: MerchantTeamMemberReader,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditLogger,
  ) {}

  execute(actor: Actor, userId: string, isActive: boolean): Promise<User> {
    return this.unitOfWork.run(async () => {
      const user = await this.members.get(actor, userId);
      if (!isActive && user.id === actor.userId) {
        throw new BusinessRuleViolationError('You cannot deactivate your own account');
      }
      if (user.isActive === isActive) return user;
      await this.users.setActive(user.id, isActive);
      await this.audit.record({
        actor,
        action: isActive ? AuditAction.USER_ACTIVATED : AuditAction.USER_DEACTIVATED,
        entityType: 'User',
        entityId: user.id,
        metadata: { email: user.email, role: user.role, merchantId: user.merchantId },
      });
      return (await this.users.findById(user.id)) as User;
    });
  }
}

// Forgotten password or lockout: a new one-time password, which also lifts the lock.
@Injectable()
export class ResetMerchantUserPasswordUseCase {
  constructor(
    private readonly members: MerchantTeamMemberReader,
    private readonly temporaryPasswords: IssueTemporaryPasswordService,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  execute(actor: Actor, userId: string): Promise<{ user: User; temporaryPassword: string }> {
    return this.unitOfWork.run(async () => {
      const user = await this.members.get(actor, userId);
      if (user.id === actor.userId) {
        throw new BusinessRuleViolationError('Change your own password from your account page');
      }
      const temporaryPassword = await this.temporaryPasswords.issue(actor, user);
      return { user, temporaryPassword };
    });
  }
}
