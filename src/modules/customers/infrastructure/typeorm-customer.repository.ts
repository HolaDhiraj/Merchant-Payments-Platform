import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { buildPage, Page, PageRequest } from '../../../shared/application/pagination';
import { DuplicateEntityError } from '../../../shared/domain/domain-errors';
import { TransactionalEntityManager } from '../../../shared/infrastructure/database/transactional-entity-manager';
import { isUniqueViolation } from '../../../shared/infrastructure/database/postgres-errors';
import { Customer, LoyaltyEntry } from '../domain/customer';
import { CustomerRepository } from '../domain/customer.repository';
import { CustomerOrmEntity, LoyaltyEntryOrmEntity } from './customer.orm-entities';

@Injectable()
export class TypeOrmCustomerRepository implements CustomerRepository {
  constructor(private readonly entityManager: TransactionalEntityManager) {}

  private get customers(): Repository<CustomerOrmEntity> {
    return this.entityManager.current().getRepository(CustomerOrmEntity);
  }

  private get entries(): Repository<LoyaltyEntryOrmEntity> {
    return this.entityManager.current().getRepository(LoyaltyEntryOrmEntity);
  }

  async findById(merchantId: string, id: string): Promise<Customer | null> {
    const row = await this.customers.findOneBy({ merchantId, id });
    return row ? toCustomer(row) : null;
  }

  async findByPhone(merchantId: string, phone: string): Promise<Customer | null> {
    const row = await this.customers.findOneBy({ merchantId, phone });
    return row ? toCustomer(row) : null;
  }

  async search(merchantId: string, text: string | undefined, page: PageRequest): Promise<Page<Customer>> {
    const builder = this.customers
      .createQueryBuilder('customer')
      .where('customer.merchant_id = :merchantId', { merchantId });
    if (text) {
      builder.andWhere('(customer.full_name ILIKE :text OR customer.phone LIKE :phone)', {
        text: `%${text.replace(/[\\%_]/g, '\\$&')}%`,
        phone: `%${text.replace(/[^\d+]/g, '')}%`,
      });
    }
    const [rows, total] = await builder
      .orderBy('customer.last_purchase_at', 'DESC', 'NULLS LAST')
      .addOrderBy('customer.id', 'ASC')
      .skip((page.page - 1) * page.pageSize)
      .take(page.pageSize)
      .getManyAndCount();
    return buildPage(rows.map(toCustomer), total, page);
  }

  async insert(customer: Customer): Promise<void> {
    try {
      await this.customers.insert({ ...customer });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateEntityError('A customer with this phone number already exists');
      }
      throw error;
    }
  }

  async updateProfile(
    merchantId: string,
    id: string,
    changes: { fullName?: string; email?: string | null },
  ): Promise<void> {
    await this.customers.update({ merchantId, id }, changes);
  }

  async deductPoints(merchantId: string, id: string, points: number): Promise<number | null> {
    const result = await this.customers
      .createQueryBuilder()
      .update(CustomerOrmEntity)
      .set({ pointsBalance: () => 'points_balance - :points' })
      .where('merchant_id = :merchantId AND id = :id AND points_balance >= :points', {
        merchantId,
        id,
        points,
      })
      .returning('points_balance')
      .execute();
    const [row] = result.raw as Array<{ points_balance: number }>;
    return row ? row.points_balance : null;
  }

  async addPoints(merchantId: string, id: string, points: number): Promise<number> {
    const result = await this.customers
      .createQueryBuilder()
      .update(CustomerOrmEntity)
      .set({ pointsBalance: () => 'points_balance + :points' })
      .where('merchant_id = :merchantId AND id = :id', { merchantId, id, points })
      .returning('points_balance')
      .execute();
    return (result.raw as Array<{ points_balance: number }>)[0].points_balance;
  }

  async recordPurchase(merchantId: string, id: string, paidMinor: number, at: Date): Promise<void> {
    await this.customers
      .createQueryBuilder()
      .update(CustomerOrmEntity)
      .set({
        totalSpentMinor: () => 'total_spent_minor + :paid',
        visitCount: () => 'visit_count + 1',
        lastPurchaseAt: at,
      })
      .where('merchant_id = :merchantId AND id = :id', { merchantId, id, paid: paidMinor })
      .execute();
  }

  async appendLedger(entry: LoyaltyEntry): Promise<void> {
    await this.entries.insert({ ...entry });
  }

  async ledger(merchantId: string, customerId: string, page: PageRequest): Promise<Page<LoyaltyEntry>> {
    const [rows, total] = await this.entries.findAndCount({
      where: { merchantId, customerId },
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (page.page - 1) * page.pageSize,
      take: page.pageSize,
    });
    return buildPage(
      rows.map((row) => ({ ...row })),
      total,
      page,
    );
  }
}

function toCustomer(row: CustomerOrmEntity): Customer {
  const { updatedAt: _updatedAt, ...customer } = row;
  return customer;
}
