import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { buildPage, Page, PageRequest } from '../../../shared/application/pagination';
import { ConcurrencyConflictError } from '../../../shared/domain/domain-errors';
import { TransactionalEntityManager } from '../../../shared/infrastructure/database/transactional-entity-manager';
import { Merchant } from '../domain/merchant';
import { MerchantRepository } from '../domain/merchant.repository';
import { MerchantOrmEntity } from './merchant.orm-entity';

@Injectable()
export class TypeOrmMerchantRepository implements MerchantRepository {
  constructor(private readonly entityManager: TransactionalEntityManager) {}

  private get repository(): Repository<MerchantOrmEntity> {
    return this.entityManager.current().getRepository(MerchantOrmEntity);
  }

  async findById(id: string): Promise<Merchant | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toDomain(row) : null;
  }

  async findByApplicationId(applicationId: string): Promise<Merchant | null> {
    const row = await this.repository.findOneBy({ applicationId });
    return row ? toDomain(row) : null;
  }

  async insert(merchant: Merchant): Promise<void> {
    await this.repository.insert(toRow(merchant));
  }

  async update(merchant: Merchant): Promise<void> {
    const { id, version, createdAt: _createdAt, ...changes } = toRow(merchant);
    const result = await this.repository
      .createQueryBuilder()
      .update(MerchantOrmEntity)
      .set({ ...changes, version: version + 1 })
      .where('id = :id AND version = :version', { id, version })
      .execute();
    if (result.affected !== 1) {
      throw new ConcurrencyConflictError('Merchant', id);
    }
    merchant.syncVersion(version + 1);
  }

  async search(query: { text?: string }, page: PageRequest): Promise<Page<Merchant>> {
    const builder = this.repository.createQueryBuilder('merchant');
    if (query.text) {
      builder.where(
        '(merchant.trading_name ILIKE :text OR merchant.legal_name ILIKE :text OR merchant.contact_email ILIKE :text)',
        { text: `%${query.text.replace(/[\\%_]/g, '\\$&')}%` },
      );
    }
    const [rows, total] = await builder
      .orderBy('merchant.created_at', 'DESC')
      .addOrderBy('merchant.id', 'ASC')
      .skip((page.page - 1) * page.pageSize)
      .take(page.pageSize)
      .getManyAndCount();
    return buildPage(rows.map(toDomain), total, page);
  }
}

function toDomain(row: MerchantOrmEntity): Merchant {
  return Merchant.restore({
    id: row.id,
    applicationId: row.applicationId,
    ownerUserId: row.ownerUserId,
    tradingName: row.tradingName,
    legalName: row.legalName,
    businessType: row.businessType,
    merchantCategoryCode: row.merchantCategoryCode,
    currency: row.currency,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    status: row.status,
    acceptedMethods: {
      cash: row.acceptCash,
      card: row.acceptCard,
      bankTransfer: row.acceptBankTransfer,
    },
    settlement:
      row.settlementAccountEncrypted && row.settlementAccountLast4
        ? {
            bankName: row.settlementBankName ?? '',
            accountHolder: row.settlementAccountHolder ?? '',
            accountNumberEncrypted: row.settlementAccountEncrypted,
            accountLast4: row.settlementAccountLast4,
          }
        : null,
    highValueThresholdMinor: row.highValueThresholdMinor,
    loyalty: {
      enabled: row.loyaltyEnabled,
      earnUnitMinor: row.loyaltyEarnUnitMinor,
      pointValueMinor: row.loyaltyPointValueMinor,
      maxRedeemPercent: row.loyaltyMaxRedeemPercent,
    },
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toRow(merchant: Merchant): MerchantOrmEntity {
  return {
    id: merchant.id,
    applicationId: merchant.applicationId,
    ownerUserId: merchant.ownerUserId,
    tradingName: merchant.tradingName,
    legalName: merchant.legalName,
    businessType: merchant.businessType,
    merchantCategoryCode: merchant.merchantCategoryCode,
    currency: merchant.currency,
    contactName: merchant.contactName,
    contactEmail: merchant.contactEmail,
    contactPhone: merchant.contactPhone,
    status: merchant.status,
    acceptCash: merchant.acceptedMethods.cash,
    acceptCard: merchant.acceptedMethods.card,
    acceptBankTransfer: merchant.acceptedMethods.bankTransfer,
    settlementBankName: merchant.settlement?.bankName ?? null,
    settlementAccountHolder: merchant.settlement?.accountHolder ?? null,
    settlementAccountEncrypted: merchant.settlement?.accountNumberEncrypted ?? null,
    settlementAccountLast4: merchant.settlement?.accountLast4 ?? null,
    highValueThresholdMinor: merchant.highValueThresholdMinor,
    loyaltyEnabled: merchant.loyalty.enabled,
    loyaltyEarnUnitMinor: merchant.loyalty.earnUnitMinor,
    loyaltyPointValueMinor: merchant.loyalty.pointValueMinor,
    loyaltyMaxRedeemPercent: merchant.loyalty.maxRedeemPercent,
    version: merchant.version,
    createdAt: merchant.createdAt,
    updatedAt: merchant.updatedAt,
  };
}
