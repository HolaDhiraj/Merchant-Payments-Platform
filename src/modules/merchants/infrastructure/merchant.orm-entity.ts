import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { bigintNumberTransformer } from '../../../shared/infrastructure/database/bigint-number.transformer';
import { BusinessType } from '../../merchant-applications/domain/model/business-details';
import { MerchantStatus } from '../domain/merchant';

@Entity({ name: 'merchants' })
export class MerchantOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ name: 'application_id', type: 'uuid' }) applicationId: string;
  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true }) ownerUserId: string | null;
  @Column({ name: 'trading_name', type: 'varchar' }) tradingName: string;
  @Column({ name: 'legal_name', type: 'varchar' }) legalName: string;
  @Column({ name: 'business_type', type: 'enum', enum: BusinessType, enumName: 'business_type' })
  businessType: BusinessType;
  @Column({ name: 'merchant_category_code', type: 'char', length: 4 }) merchantCategoryCode: string;
  @Column({ type: 'char', length: 3 }) currency: string;
  @Column({ name: 'contact_name', type: 'varchar' }) contactName: string;
  @Column({ name: 'contact_email', type: 'varchar' }) contactEmail: string;
  @Column({ name: 'contact_phone', type: 'varchar' }) contactPhone: string;
  @Column({ type: 'enum', enum: MerchantStatus, enumName: 'merchant_status' }) status: MerchantStatus;
  @Column({ name: 'accept_cash', type: 'boolean' }) acceptCash: boolean;
  @Column({ name: 'accept_card', type: 'boolean' }) acceptCard: boolean;
  @Column({ name: 'accept_bank_transfer', type: 'boolean' }) acceptBankTransfer: boolean;
  @Column({ name: 'settlement_bank_name', type: 'varchar', nullable: true }) settlementBankName: string | null;
  @Column({ name: 'settlement_account_holder', type: 'varchar', nullable: true })
  settlementAccountHolder: string | null;
  @Column({ name: 'settlement_account_encrypted', type: 'text', nullable: true })
  settlementAccountEncrypted: string | null;
  @Column({ name: 'settlement_account_last4', type: 'varchar', nullable: true })
  settlementAccountLast4: string | null;
  @Column({ name: 'high_value_threshold_minor', type: 'bigint', transformer: bigintNumberTransformer })
  highValueThresholdMinor: number;
  @Column({ name: 'loyalty_enabled', type: 'boolean' }) loyaltyEnabled: boolean;
  @Column({ name: 'loyalty_earn_unit_minor', type: 'bigint', transformer: bigintNumberTransformer })
  loyaltyEarnUnitMinor: number;
  @Column({ name: 'loyalty_point_value_minor', type: 'bigint', transformer: bigintNumberTransformer })
  loyaltyPointValueMinor: number;
  @Column({ name: 'loyalty_max_redeem_percent', type: 'smallint' }) loyaltyMaxRedeemPercent: number;
  @Column({ type: 'integer' }) version: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
