import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../shared/domain/actor';
import { Role } from '../../../shared/domain/role.enum';
import { Clock, CLOCK } from '../../../shared/domain/clock';
import { IdGenerator, ID_GENERATOR } from '../../../shared/domain/id-generator';
import { DuplicateEntityError } from '../../../shared/domain/domain-errors';
import { UNIT_OF_WORK, UnitOfWork } from '../../../shared/application/unit-of-work';
import { AuditLogger } from '../../audit/application/audit-logger';
import { AuditAction } from '../../audit/domain/audit-action.enum';
import { User } from '../domain/user';
import { USER_REPOSITORY, UserRepository } from '../domain/user.repository';
import { PASSWORD_HASHER, PasswordHasher } from '../domain/password-hasher';

export interface CreateUserCommand {
  email: string;
  fullName: string;
  role: Role;
  password: string;
  // Merchant users only: the merchant (tenant) they belong to.
  merchantId?: string | null;
  // True when someone else chose the password, so the user must replace it at first sign-in.
  mustChangePassword?: boolean;
}

// Creates a platform user (ADMIN only, enforced at the controller).
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly audit: AuditLogger,
  ) {}

  async execute(actor: Actor | null, command: CreateUserCommand): Promise<User> {
    const email = User.normaliseEmail(command.email);
    if (await this.users.findByEmail(email)) {
      throw new DuplicateEntityError('A user with this email already exists');
    }

    const now = this.clock.now();
    const user = User.create({
      id: this.ids.next(),
      email,
      fullName: command.fullName.trim(),
      role: command.role,
      passwordHash: await this.passwordHasher.hash(command.password),
      isActive: true,
      merchantId: command.merchantId ?? null,
      mustChangePassword: command.mustChangePassword ?? false,
      createdAt: now,
      updatedAt: now,
    });

    await this.unitOfWork.run(async () => {
      await this.users.insert(user);
      await this.audit.record({
        actor,
        action: AuditAction.USER_CREATED,
        entityType: 'User',
        entityId: user.id,
        metadata: { role: user.role, email: user.email, merchantId: user.merchantId },
      });
    });

    return user;
  }
}
