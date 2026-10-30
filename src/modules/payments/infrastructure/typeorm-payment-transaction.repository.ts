import { Injectable } from '@nestjs/common';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { buildPage, Page, PageRequest } from '../../../shared/application/pagination';
import { ConcurrencyConflictError, DuplicateEntityError } from '../../../shared/domain/domain-errors';
import { TransactionalEntityManager } from '../../../shared/infrastructure/database/transactional-entity-manager';
import { isUniqueViolation } from '../../../shared/infrastructure/database/postgres-errors';
import { PaymentTransaction } from '../domain/payment-transaction';
import {
  PaymentSearch,
  PaymentTransactionRepository,
  PaymentView,
  RecentActivity,
  RecentActivityQuery,
} from '../domain/payment-transaction.repository';
import { PaymentLineOrmEntity, PaymentTransactionOrmEntity } from './payment.orm-entities';

interface ViewColumns {
  cashier_name: string;
  customer_name: string | null;
  customer_phone: string | null;
  reviewer_name: string | null;
}

@Injectable()
export class TypeOrmPaymentTransactionRepository implements PaymentTransactionRepository {
  constructor(private readonly entityManager: TransactionalEntityManager) {}

  private get transactions(): Repository<PaymentTransactionOrmEntity> {
    return this.entityManager.current().getRepository(PaymentTransactionOrmEntity);
  }

  private get lines(): Repository<PaymentLineOrmEntity> {
    return this.entityManager.current().getRepository(PaymentLineOrmEntity);
  }

  async insert(payment: PaymentTransaction): Promise<void> {
    try {
      await this.transactions.insert(toRow(payment));
    } catch (error) {
      // uq_payments_idempotency: the same request is already being processed.
      if (isUniqueViolation(error)) throw new DuplicateEntityError('This payment request was already received');
      throw error;
    }
    await this.lines.insert(
      payment.lines.map((line) => ({ ...line, transactionId: payment.id })),
    );
  }

  // Lines are immutable once recorded; only the payment row changes.
  async update(payment: PaymentTransaction): Promise<void> {
    const { id, version, createdAt: _createdAt, ...changes } = toRow(payment);
    const result = await this.transactions
      .createQueryBuilder()
      .update(PaymentTransactionOrmEntity)
      .set({ ...changes, version: version + 1 })
      .where('id = :id AND version = :version', { id, version })
      .execute();
    if (result.affected !== 1) throw new ConcurrencyConflictError('Payment', id);
    payment.syncVersion(version + 1);
  }

  async findById(merchantId: string, id: string): Promise<PaymentTransaction | null> {
    const row = await this.transactions.findOneBy({ merchantId, id });
    return row ? this.withLines(row) : null;
  }

  async findByIdempotencyKey(merchantId: string, key: string): Promise<PaymentTransaction | null> {
    const row = await this.transactions.findOneBy({ merchantId, idempotencyKey: key });
    return row ? this.withLines(row) : null;
  }

  async view(merchantId: string, id: string): Promise<PaymentView | null> {
    const { entities, raw } = await this.viewQuery(merchantId)
      .andWhere('payment.id = :id', { id })
      .getRawAndEntities<ViewColumns>();
    if (entities.length === 0) return null;
    const lines = await this.linesFor([id]);
    return toView(entities[0], raw[0], lines.get(id) ?? []);
  }

  async search(merchantId: string, query: PaymentSearch, page: PageRequest): Promise<Page<PaymentView>> {
    const builder = this.viewQuery(merchantId);
    if (query.status) builder.andWhere('payment.status = :status', { status: query.status });
    if (query.method) builder.andWhere('payment.method = :method', { method: query.method });
    if (query.customerId) builder.andWhere('payment.customer_id = :customerId', { customerId: query.customerId });
    if (query.cashierId) builder.andWhere('payment.cashier_id = :cashierId', { cashierId: query.cashierId });
    if (query.from) builder.andWhere('payment.created_at >= :from', { from: query.from });
    if (query.to) builder.andWhere('payment.created_at < :to', { to: query.to });
    if (query.text) {
      builder.andWhere(
        '(payment.reference ILIKE :text OR customer.full_name ILIKE :text OR customer.phone LIKE :phone)',
        { text: `%${query.text.replace(/[\\%_]/g, '\\$&')}%`, phone: `%${query.text.replace(/[^\d+]/g, '') || '-'}%` },
      );
    }

    const total = await builder.clone().getCount();
    const { entities, raw } = await builder
      .orderBy('payment.created_at', 'DESC')
      .addOrderBy('payment.id', 'ASC')
      .offset((page.page - 1) * page.pageSize)
      .limit(page.pageSize)
      .getRawAndEntities<ViewColumns>();
    const lines = await this.linesFor(entities.map((row) => row.id));
    return buildPage(
      entities.map((row, index) => toView(row, raw[index], lines.get(row.id) ?? [])),
      total,
      page,
    );
  }

  async recentActivity(query: RecentActivityQuery): Promise<RecentActivity> {
    const tenMinutesAgo = new Date(query.now.getTime() - 10 * 60_000);
    const thirtyMinutesAgo = new Date(query.now.getTime() - 30 * 60_000);
    const [row] = await this.entityManager.current().query(
      `SELECT
         count(*) FILTER (WHERE instrument_fingerprint = $2 AND created_at >= $4) AS instrument_attempts,
         count(*) FILTER (WHERE instrument_fingerprint = $2 AND created_at >= $5 AND status = 'DECLINED') AS instrument_declines,
         count(*) FILTER (WHERE customer_id = $3 AND created_at >= $4) AS customer_payments
       FROM payment_transactions
       WHERE merchant_id = $1 AND created_at >= $5
         AND (instrument_fingerprint = $2 OR customer_id = $3)`,
      [query.merchantId, query.instrumentFingerprint, query.customerId, tenMinutesAgo, thirtyMinutesAgo],
    );
    return {
      instrumentAttempts10m: Number(row?.instrument_attempts ?? 0),
      instrumentDeclines30m: Number(row?.instrument_declines ?? 0),
      customerPayments10m: Number(row?.customer_payments ?? 0),
    };
  }

  private viewQuery(merchantId: string): SelectQueryBuilder<PaymentTransactionOrmEntity> {
    return this.transactions
      .createQueryBuilder('payment')
      .leftJoin('users', 'cashier', 'cashier.id = payment.cashier_id')
      .leftJoin('users', 'reviewer', 'reviewer.id = payment.reviewed_by_id')
      .leftJoin('customers', 'customer', 'customer.id = payment.customer_id')
      .addSelect('cashier.full_name', 'cashier_name')
      .addSelect('reviewer.full_name', 'reviewer_name')
      .addSelect('customer.full_name', 'customer_name')
      .addSelect('customer.phone', 'customer_phone')
      .where('payment.merchant_id = :merchantId', { merchantId });
  }

  private async withLines(row: PaymentTransactionOrmEntity): Promise<PaymentTransaction> {
    const lines = await this.linesFor([row.id]);
    return toDomain(row, lines.get(row.id) ?? []);
  }

  private async linesFor(ids: string[]): Promise<Map<string, PaymentLineOrmEntity[]>> {
    const byPayment = new Map<string, PaymentLineOrmEntity[]>();
    if (ids.length === 0) return byPayment;
    const rows = await this.lines.find({ where: { transactionId: In(ids) }, order: { name: 'ASC' } });
    for (const line of rows) {
      byPayment.set(line.transactionId, [...(byPayment.get(line.transactionId) ?? []), line]);
    }
    return byPayment;
  }
}

function toDomain(row: PaymentTransactionOrmEntity, lines: PaymentLineOrmEntity[]): PaymentTransaction {
  return PaymentTransaction.restore({
    id: row.id,
    merchantId: row.merchantId,
    reference: row.reference,
    idempotencyKey: row.idempotencyKey,
    requestFingerprint: row.requestFingerprint,
    cashierId: row.cashierId,
    customerId: row.customerId,
    method: row.method,
    status: row.status,
    currency: row.currency,
    lines: lines.map(({ transactionId: _transactionId, ...line }) => line),
    subtotalMinor: row.subtotalMinor,
    discountMinor: row.discountMinor,
    pointsRedeemed: row.pointsRedeemed,
    pointsDiscountMinor: row.pointsDiscountMinor,
    totalMinor: row.totalMinor,
    amountTenderedMinor: row.amountTenderedMinor,
    changeMinor: row.changeMinor,
    pointsEarned: row.pointsEarned,
    instrument: {
      brand: row.instrumentBrand,
      last4: row.instrumentLast4,
      fingerprint: row.instrumentFingerprint,
    },
    authorizationCode: row.authorizationCode,
    declineReason: row.declineReason,
    fraud: { score: row.fraudScore, reasons: row.fraudReasons, decision: row.fraudDecision },
    reviewedById: row.reviewedById,
    reviewedAt: row.reviewedAt,
    reviewNote: row.reviewNote,
    completedAt: row.completedAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toView(row: PaymentTransactionOrmEntity, raw: ViewColumns, lines: PaymentLineOrmEntity[]): PaymentView {
  return {
    payment: toDomain(row, lines),
    cashierName: raw.cashier_name,
    customerName: raw.customer_name,
    customerPhone: raw.customer_phone,
    reviewerName: raw.reviewer_name,
  };
}

function toRow(payment: PaymentTransaction): PaymentTransactionOrmEntity {
  return {
    id: payment.id,
    merchantId: payment.merchantId,
    reference: payment.reference,
    idempotencyKey: payment.idempotencyKey,
    requestFingerprint: payment.requestFingerprint,
    cashierId: payment.cashierId,
    customerId: payment.customerId,
    method: payment.method,
    status: payment.status,
    currency: payment.currency,
    subtotalMinor: payment.subtotalMinor,
    discountMinor: payment.discountMinor,
    pointsRedeemed: payment.pointsRedeemed,
    pointsDiscountMinor: payment.pointsDiscountMinor,
    totalMinor: payment.totalMinor,
    amountTenderedMinor: payment.amountTenderedMinor,
    changeMinor: payment.changeMinor,
    pointsEarned: payment.pointsEarned,
    instrumentBrand: payment.instrument.brand,
    instrumentLast4: payment.instrument.last4,
    instrumentFingerprint: payment.instrument.fingerprint,
    authorizationCode: payment.authorizationCode,
    declineReason: payment.declineReason,
    fraudScore: payment.fraud.score,
    fraudReasons: payment.fraud.reasons,
    fraudDecision: payment.fraud.decision,
    reviewedById: payment.reviewedById,
    reviewedAt: payment.reviewedAt,
    reviewNote: payment.reviewNote,
    completedAt: payment.completedAt,
    version: payment.version,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}
