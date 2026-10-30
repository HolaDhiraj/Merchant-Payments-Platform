import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { USER_REPOSITORY } from './domain/user.repository';
import { PASSWORD_HASHER } from './domain/password-hasher';
import { UserOrmEntity } from './infrastructure/user.orm-entity';
import { TypeOrmUserRepository } from './infrastructure/typeorm-user.repository';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { CreateUserUseCase } from './application/create-user.use-case';
import { ListUsersUseCase } from './application/list-users.use-case';
import { GetCurrentUserUseCase } from './application/get-current-user.use-case';
import { UnlockUserUseCase } from './application/unlock-user.use-case';
import { SetUserActiveUseCase } from './application/set-user-active.use-case';
import { IssueTemporaryPasswordService } from './application/issue-temporary-password.service';
import { UsersController } from './presentation/users.controller';

// Owns user accounts. Exposes the repository and hasher ports to auth and other modules.
@Module({
  imports: [TypeOrmModule.forFeature([UserOrmEntity]), AuditModule],
  controllers: [UsersController],
  providers: [
    { provide: USER_REPOSITORY, useClass: TypeOrmUserRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    CreateUserUseCase,
    ListUsersUseCase,
    GetCurrentUserUseCase,
    UnlockUserUseCase,
    SetUserActiveUseCase,
    IssueTemporaryPasswordService,
  ],
  exports: [USER_REPOSITORY, PASSWORD_HASHER, CreateUserUseCase, IssueTemporaryPasswordService],
})
export class UsersModule {}
