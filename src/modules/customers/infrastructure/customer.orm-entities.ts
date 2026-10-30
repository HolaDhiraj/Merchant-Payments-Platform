import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { bigintNumberTransformer } from '../../../shared/infrastructure/database/bigint-number.transformer';
import { LoyaltyEntryType } from '../domain/customer';

@Entity({ name: 'customers' })
export class CustomerOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ name: 'merchant_id', type: 'uuid' }) merchantId: string;
  @Column({ name: 'full_name', type: 'varchar' }) fullName: string;
  @Column({ type: 'varchar' }) phone: string;
  @Column({ type: 'varchar', nullable: true }) email: string | null;
  @Column({ name: 'points_balance', type: 'integer' }) pointsBalance: number;
  @Column({ name: 'total_spent_minor', type: 'bigint', transformer: bigintNumberTransformer })
  totalSpentMinor: number;
  @Column({ name: 'visit_count', type: 'integer' }) visitCount: number;
  @Column({ name: 'last_purchase_at', type: 'timestamptz', nullable: true }) lastPurchaseAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}

@Entity({ name: 'loyalty_ledger' })
export class LoyaltyEntryOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ name: 'merchant_id', type: 'uuid' }) merchantId: string;
  @Column({ name: 'customer_id', type: 'uuid' }) customerId: string;
  @Column({ name: 'transaction_id', type: 'uuid', nullable: true }) transactionId: string | null;
  @Column({ type: 'enum', enum: LoyaltyEntryType, enumName: 'loyalty_entry_type' }) type: LoyaltyEntryType;
  @Column({ type: 'integer' }) points: number;
  @Column({ name: 'balance_after', type: 'integer' }) balanceAfter: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
