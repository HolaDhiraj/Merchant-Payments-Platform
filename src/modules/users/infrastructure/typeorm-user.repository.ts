import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TransactionalEntityManager } from '../../../shared/infrastructure/database/transactional-entity-manager';
import { isUniqueViolation } from '../../../shared/infrastructure/database/postgres-errors';
import { DuplicateEntityError } from '../../../shared/domain/domain-errors';
import { buildPage, Page, PageRequest } from '../../../shared/application/pagination';
import { User } from '../domain/user';
import { UserRepository, UserSearchCriteria } from '../domain/user.repository';
import { UserOrmEntity } from './user.orm-entity';

// TypeORM adapter for the UserRepository port.
@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(private readonly entityManager: TransactionalEntityManager) {}

  private get repository(): Repository<UserOrmEntity> {
    return this.entityManager.current().getRepository(UserOrmEntity);
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.repository.findOneBy({ email: User.normaliseEmail(email) });
    return row ? this.toDomain(row) : null;
  }

  async insert(user: User): Promise<void> {
    try {
      await this.repository.insert({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        passwordHash: user.passwordHash,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    } catch (error) {
      // The unique index is the real guard against two concurrent sign-ups with one email.
      if (isUniqueViolation(error)) {
        throw new DuplicateEntityError('A user with this email already exists');
      }
      throw error;
    }
  }

  async search(criteria: UserSearchCriteria, page: PageRequest): Promise<Page<User>> {
    const [rows, total] = await this.repository.findAndCount({
      where: criteria.role ? { role: criteria.role } : {},
      order: { fullName: 'ASC', id: 'ASC' },
      skip: (page.page - 1) * page.pageSize,
      take: page.pageSize,
    });
    return buildPage(
      rows.map((row) => this.toDomain(row)),
      total,
      page,
    );
  }

  private toDomain(row: UserOrmEntity): User {
    return User.restore({ ...row });
  }
}
