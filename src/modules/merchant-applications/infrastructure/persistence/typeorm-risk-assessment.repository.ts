import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TransactionalEntityManager } from '../../../../shared/infrastructure/database/transactional-entity-manager';
import { RiskAssessment } from '../../domain/model/risk-assessment';
import { RiskAssessmentRepository } from '../../domain/ports/risk-assessment.repository';
import { RiskAssessmentOrmEntity } from './risk-assessment.orm-entity';

@Injectable()
export class TypeOrmRiskAssessmentRepository implements RiskAssessmentRepository {
  constructor(private readonly entityManager: TransactionalEntityManager) {}

  private get repository(): Repository<RiskAssessmentOrmEntity> {
    return this.entityManager.current().getRepository(RiskAssessmentOrmEntity);
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<RiskAssessment | null> {
    const row = await this.repository.findOneBy({ idempotencyKey });
    return row ? this.toDomain(row) : null;
  }

  async findLatestByApplicationId(applicationId: string): Promise<RiskAssessment | null> {
    const row = await this.repository.findOne({
      where: { applicationId },
      order: { submissionNumber: 'DESC' },
    });
    return row ? this.toDomain(row) : null;
  }

  // INSERT ... ON CONFLICT DO NOTHING: a concurrent writer with the same key waits for the first
  // transaction and then inserts nothing. No error is raised, so the caller's transaction stays usable.
  async insertIfAbsent(assessment: RiskAssessment): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .into(RiskAssessmentOrmEntity)
      .values({ ...assessment })
      .orIgnore()
      .returning(['id'])
      .execute();
    return (result.raw as unknown[]).length === 1;
  }

  private toDomain(row: RiskAssessmentOrmEntity): RiskAssessment {
    const { createdAt: _createdAt, ...assessment } = row;
    return assessment;
  }
}
