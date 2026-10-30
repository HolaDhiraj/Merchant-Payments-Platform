import { Page, PageRequest } from '../../../shared/application/pagination';
import { Customer, LoyaltyEntry } from './customer';

// All methods are scoped by merchant id. Point balances only change through the atomic
// methods below (single UPDATE ... RETURNING), so concurrent checkouts cannot overspend points.
export interface CustomerRepository {
  findById(merchantId: string, id: string): Promise<Customer | null>;
  findByPhone(merchantId: string, phone: string): Promise<Customer | null>;
  search(merchantId: string, text: string | undefined, page: PageRequest): Promise<Page<Customer>>;
  insert(customer: Customer): Promise<void>;
  updateProfile(merchantId: string, id: string, changes: { fullName?: string; email?: string | null }): Promise<void>;
  // Returns the new balance, or null when the balance is lower than `points`.
  deductPoints(merchantId: string, id: string, points: number): Promise<number | null>;
  addPoints(merchantId: string, id: string, points: number): Promise<number>;
  recordPurchase(merchantId: string, id: string, paidMinor: number, at: Date): Promise<void>;
  appendLedger(entry: LoyaltyEntry): Promise<void>;
  ledger(merchantId: string, customerId: string, page: PageRequest): Promise<Page<LoyaltyEntry>>;
}

export const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY');
