import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { bigintNumberTransformer } from '../../../shared/infrastructure/database/bigint-number.transformer';
import { PaymentMethod } from '../../merchants/domain/payment-method.enum';
import { FraudDecision } from '../domain/fraud-screening';
import { PaymentStatus } from '../domain/payment-transaction';

const money = { type: 'bigint' as const, transformer: bigintNumberTransformer };

@Entity({ name: 'payment_transactions' })
export class PaymentTransactionOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ name: 'merchant_id', type: 'uuid' }) merchantId: string;
  @Column({ type: 'varchar' }) reference: string;
  @Column({ name: 'idempotency_key', type: 'varchar' }) idempotencyKey: string;
  @Column({ name: 'request_fingerprint', type: 'char', length: 64 }) requestFingerprint: string;
  @Column({ name: 'cashier_id', type: 'uuid' }) cashierId: string;
  @Column({ name: 'customer_id', type: 'uuid', nullable: true }) customerId: string | null;
  @Column({ type: 'enum', enum: PaymentMethod, enumName: 'payment_method' }) method: PaymentMethod;
  @Column({ type: 'enum', enum: PaymentStatus, enumName: 'payment_status' }) status: PaymentStatus;
  @Column({ type: 'char', length: 3 }) currency: string;
  @Column({ name: 'subtotal_minor', ...money }) subtotalMinor: number;
  @Column({ name: 'discount_minor', ...money }) discountMinor: number;
  @Column({ name: 'points_redeemed', type: 'integer' }) pointsRedeemed: number;
  @Column({ name: 'points_discount_minor', ...money }) pointsDiscountMinor: number;
  @Column({ name: 'total_minor', ...money }) totalMinor: number;
  @Column({ name: 'amount_tendered_minor', ...money, nullable: true }) amountTenderedMinor: number | null;
  @Column({ name: 'change_minor', ...money, nullable: true }) changeMinor: number | null;
  @Column({ name: 'points_earned', type: 'integer' }) pointsEarned: number;
  @Column({ name: 'instrument_brand', type: 'varchar', nullable: true }) instrumentBrand: string | null;
  @Column({ name: 'instrument_last4', type: 'varchar', nullable: true }) instrumentLast4: string | null;
  @Column({ name: 'instrument_fingerprint', type: 'char', length: 64, nullable: true })
  instrumentFingerprint: string | null;
  @Column({ name: 'authorization_code', type: 'varchar', nullable: true }) authorizationCode: string | null;
  @Column({ name: 'decline_reason', type: 'varchar', nullable: true }) declineReason: string | null;
  @Column({ name: 'fraud_score', type: 'smallint' }) fraudScore: number;
  @Column({ name: 'fraud_reasons', type: 'jsonb' }) fraudReasons: string[];
  @Column({ name: 'fraud_decision', type: 'enum', enum: FraudDecision, enumName: 'fraud_decision' })
  fraudDecision: FraudDecision;
  @Column({ name: 'reviewed_by_id', type: 'uuid', nullable: true }) reviewedById: string | null;
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true }) reviewedAt: Date | null;
  @Column({ name: 'review_note', type: 'varchar', nullable: true }) reviewNote: string | null;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt: Date | null;
  @Column({ type: 'integer' }) version: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}

@Entity({ name: 'payment_transaction_items' })
export class PaymentLineOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Column({ name: 'transaction_id', type: 'uuid' }) transactionId: string;
  @Column({ name: 'product_id', type: 'uuid', nullable: true }) productId: string | null;
  @Column({ type: 'varchar' }) name: string;
  @Column({ type: 'varchar' }) sku: string;
  @Column({ name: 'unit_price_minor', ...money }) unitPriceMinor: number;
  @Column({ name: 'discount_percent', type: 'smallint' }) discountPercent: number;
  @Column({ type: 'integer' }) quantity: number;
  @Column({ name: 'line_total_minor', ...money }) lineTotalMinor: number;
}
