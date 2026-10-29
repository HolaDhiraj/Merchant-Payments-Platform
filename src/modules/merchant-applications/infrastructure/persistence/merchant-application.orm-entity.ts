import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { bigintNumberTransformer } from '../../../../shared/infrastructure/database/bigint-number.transformer';
import { ApplicationStatus } from '../../domain/model/application-status.enum';
import { BusinessType, SalesChannel } from '../../domain/model/business-details';
import { ReviewDecision } from '../../domain/model/review-decision.enum';
import { RiskLevel, RiskStatus } from '../../domain/model/risk.enums';

// Database shape of a merchant application. The tax id is stored only encrypted,
// plus its last four characters for display and support look-ups.
@Entity({ name: 'merchant_applications' })
@Index('idx_merchant_applications_created_by', ['createdById', 'createdAt'])
@Index('idx_merchant_applications_status', ['status', 'createdAt'])
@Index('idx_merchant_applications_reviewer', ['assignedReviewerId', 'status'])
export class MerchantApplicationOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @Column({ name: 'business_name', type: 'varchar', length: 200 })
  businessName: string;

  @Column({ name: 'legal_business_name', type: 'varchar', length: 200 })
  legalBusinessName: string;

  @Column({ name: 'business_type', type: 'enum', enum: BusinessType, enumName: 'business_type' })
  businessType: BusinessType;

  @Column({ name: 'tax_id_encrypted', type: 'text' })
  taxIdEncrypted: string;

  @Column({ name: 'tax_id_last4', type: 'varchar', length: 4 })
  taxIdLast4: string;

  @Column({ name: 'owner_full_name', type: 'varchar', length: 200 })
  ownerFullName: string;

  @Column({ name: 'owner_email', type: 'varchar', length: 320 })
  ownerEmail: string;

  @Column({ name: 'owner_phone', type: 'varchar', length: 32 })
  ownerPhone: string;

  @Column({ name: 'merchant_category_code', type: 'char', length: 4 })
  merchantCategoryCode: string;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({
    name: 'expected_monthly_volume_minor',
    type: 'bigint',
    transformer: bigintNumberTransformer,
  })
  expectedMonthlyVolumeMinor: number;

  @Column({ name: 'average_ticket_minor', type: 'bigint', transformer: bigintNumberTransformer })
  averageTicketMinor: number;

  @Column({ name: 'sales_channel', type: 'enum', enum: SalesChannel, enumName: 'sales_channel' })
  salesChannel: SalesChannel;

  @Column({ type: 'enum', enum: ApplicationStatus, enumName: 'application_status' })
  status: ApplicationStatus;

  @Column({ name: 'risk_status', type: 'enum', enum: RiskStatus, enumName: 'risk_status' })
  riskStatus: RiskStatus;

  @Column({
    name: 'risk_level',
    type: 'enum',
    enum: RiskLevel,
    enumName: 'risk_level',
    nullable: true,
  })
  riskLevel: RiskLevel | null;

  @Column({ name: 'risk_score', type: 'smallint', nullable: true })
  riskScore: number | null;

  @Column({ name: 'assigned_reviewer_id', type: 'uuid', nullable: true })
  assignedReviewerId: string | null;

  @Column({ name: 'submission_count', type: 'integer', default: 0 })
  submissionCount: number;

  @Column({
    type: 'enum',
    enum: ReviewDecision,
    enumName: 'review_decision',
    nullable: true,
  })
  decision: ReviewDecision | null;

  @Column({ name: 'decision_reason', type: 'text', nullable: true })
  decisionReason: string | null;

  @Column({ name: 'decided_by_id', type: 'uuid', nullable: true })
  decidedById: string | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Managed manually by the repository (compare-and-swap) for optimistic locking.
  @Column({ type: 'integer', default: 0 })
  version: number;
}
