import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, Unique } from 'typeorm';
import { RiskLevel } from '../../domain/model/risk.enums';

export const RISK_ASSESSMENT_IDEMPOTENCY_CONSTRAINT = 'uq_risk_assessments_idempotency_key';

@Entity({ name: 'risk_assessments' })
@Unique(RISK_ASSESSMENT_IDEMPOTENCY_CONSTRAINT, ['idempotencyKey'])
@Index('idx_risk_assessments_application', ['applicationId', 'submissionNumber'])
export class RiskAssessmentOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'submission_number', type: 'integer' })
  submissionNumber: number;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 120 })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 64 })
  provider: string;

  @Column({ name: 'provider_reference', type: 'varchar', length: 128 })
  providerReference: string;

  @Column({ type: 'smallint' })
  score: number;

  @Column({ type: 'enum', enum: RiskLevel, enumName: 'risk_level' })
  level: RiskLevel;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  reasons: string[];

  @Column({ name: 'assessed_at', type: 'timestamptz' })
  assessedAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
