import { Page, PageRequest } from '../../../shared/application/pagination';
import { Merchant } from './merchant';

export interface MerchantRepository {
  findById(id: string): Promise<Merchant | null>;
  findByApplicationId(applicationId: string): Promise<Merchant | null>;
  insert(merchant: Merchant): Promise<void>;
  // Optimistic locking on the version column; throws ConcurrencyConflictError when stale.
  update(merchant: Merchant): Promise<void>;
  search(query: { text?: string }, page: PageRequest): Promise<Page<Merchant>>;
}

export const MERCHANT_REPOSITORY = Symbol('MERCHANT_REPOSITORY');
