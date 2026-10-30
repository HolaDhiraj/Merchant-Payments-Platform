import { Page, PageRequest } from '../../../shared/application/pagination';
import { PaymentMethod } from '../../merchants/domain/payment-method.enum';
import { PaymentStatus, PaymentTransaction } from './payment-transaction';

export interface PaymentSearch {
  status?: PaymentStatus;
  method?: PaymentMethod;
  customerId?: string;
  cashierId?: string;
  // Reference, customer name or phone.
  text?: string;
  from?: Date;
  to?: Date;
}

// A payment with the names the screens show next to it.
export interface PaymentView {
  payment: PaymentTransaction;
  cashierName: string;
  customerName: string | null;
  customerPhone: string | null;
  reviewerName: string | null;
}

// Recent activity used by the fraud rules.
export interface RecentActivityQuery {
  merchantId: string;
  instrumentFingerprint: string | null;
  customerId: string | null;
  now: Date;
}

export interface RecentActivity {
  instrumentAttempts10m: number;
  instrumentDeclines30m: number;
  customerPayments10m: number;
}

// All reads are scoped by merchant id.
export interface PaymentTransactionRepository {
  insert(payment: PaymentTransaction): Promise<void>;
  // Optimistic locking on version; throws ConcurrencyConflictError when stale.
  update(payment: PaymentTransaction): Promise<void>;
  findById(merchantId: string, id: string): Promise<PaymentTransaction | null>;
  findByIdempotencyKey(merchantId: string, key: string): Promise<PaymentTransaction | null>;
  view(merchantId: string, id: string): Promise<PaymentView | null>;
  search(merchantId: string, query: PaymentSearch, page: PageRequest): Promise<Page<PaymentView>>;
  recentActivity(query: RecentActivityQuery): Promise<RecentActivity>;
}

export const PAYMENT_TRANSACTION_REPOSITORY = Symbol('PAYMENT_TRANSACTION_REPOSITORY');

export interface SalesTotals {
  collectedMinor: number;
  count: number;
}

export interface SalesSummary {
  currency: string;
  today: SalesTotals;
  last7Days: SalesTotals;
  last30Days: SalesTotals;
  allTime: SalesTotals;
  averageTicketMinor: number;
  byMethod: Array<{ method: PaymentMethod } & SalesTotals>;
  // One entry per day (merchant's time zone), oldest first, including days with no sales.
  daily: Array<{ date: string } & SalesTotals>;
  topProducts: Array<{ name: string; quantity: number; revenueMinor: number }>;
  pendingReview: SalesTotals;
  declinedToday: number;
  discountsGivenMinor: number;
  pointsRedeemedMinor: number;
  customersServed: number;
}

export interface PaymentReports {
  summary(merchantId: string, currency: string, timeZone: string, days: number, now: Date): Promise<SalesSummary>;
}

export const PAYMENT_REPORTS = Symbol('PAYMENT_REPORTS');
