import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TransactionalEntityManager } from '../../../../shared/infrastructure/database/transactional-entity-manager';
import { buildPage, Page, PageRequest } from '../../../../shared/application/pagination';
import { ConcurrencyConflictError } from '../../../../shared/domain/domain-errors';
import { MerchantApplication } from '../../domain/model/merchant-application';
import {
  ApplicationSearchCriteria,
  MerchantApplicationRepository,
} from '../../domain/ports/merchant-application.repository';
import { MerchantApplicationMapper } from './merchant-application.mapper';
import { MerchantApplicationOrmEntity } from './merchant-application.orm-entity';

@Injectable()
export class TypeOrmMerchantApplicationRepository implements MerchantApplicationRepository {
  constructor(
    private readonly entityManager: TransactionalEntityManager,
    private readonly mapper: MerchantApplicationMapper,
  ) {}

  private get repository(): Repository<MerchantApplicationOrmEntity> {
    return this.entityManager.current().getRepository(MerchantApplicationOrmEntity);
  }

  async findById(id: string): Promise<MerchantApplication | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? this.mapper.toDomain(row) : null;
  }

  async insert(application: MerchantApplication): Promise<void> {
    await this.repository.insert(this.mapper.toRow(application));
  }

  // Compare-and-swap on the version column: the UPDATE only matches if nobody else wrote
  // since we loaded the aggregate. Zero affected rows means a concurrent modification.
  async update(application: MerchantApplication): Promise<void> {
    const { id, version, ...changes } = this.mapper.toRow(application);
    const nextVersion = version + 1;
    const result = await this.repository
      .createQueryBuilder()
      .update(MerchantApplicationOrmEntity)
      .set({ ...changes, version: nextVersion })
      .where('id = :id AND version = :version', { id, version })
      .execute();

    if (result.affected !== 1) {
      throw new ConcurrencyConflictError('MerchantApplication', id);
    }
    application.syncVersion(nextVersion);
  }

  async search(
    criteria: ApplicationSearchCriteria,
    page: PageRequest,
  ): Promise<Page<MerchantApplication>> {
    const query = this.repository.createQueryBuilder('application');

    if (criteria.scope.createdById) {
      query.andWhere('application.created_by_id = :createdById', {
        createdById: criteria.scope.createdById,
      });
    }
    if (criteria.scope.excludeStatuses?.length) {
      query.andWhere('application.status NOT IN (:...excludeStatuses)', {
        excludeStatuses: criteria.scope.excludeStatuses,
      });
    }
    if (criteria.status) {
      query.andWhere('application.status = :status', { status: criteria.status });
    }
    if (criteria.assignedReviewerId) {
      query.andWhere('application.assigned_reviewer_id = :assignedReviewerId', {
        assignedReviewerId: criteria.assignedReviewerId,
      });
    }

    const [rows, total] = await query
      .orderBy('application.created_at', 'DESC')
      .addOrderBy('application.id', 'ASC')
      .skip((page.page - 1) * page.pageSize)
      .take(page.pageSize)
      .getManyAndCount();

    return buildPage(
      rows.map((row) => this.mapper.toDomain(row)),
      total,
      page,
    );
  }
}
