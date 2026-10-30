// Mirrors the API's response DTOs (see /api/docs). Kept hand-written and small on purpose:
// the client only declares the fields it actually renders.

export type PlatformRole = 'ADMIN' | 'REVIEWER' | 'SALES';
export type MerchantRole = 'MERCHANT_ADMIN' | 'MERCHANT_SALES' | 'MERCHANT_REVIEWER';
export type Role = PlatformRole | MerchantRole;

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'INFO_REQUESTED'
  | 'APPROVED'
  | 'REJECTED';

export type RiskStatus = 'NOT_STARTED' | 'PENDING' | 'COMPLETED' | 'FAILED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type ReviewDecision = 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
export type BusinessType = 'SOLE_PROPRIETORSHIP' | 'PARTNERSHIP' | 'LLC' | 'CORPORATION' | 'NON_PROFIT';
export type SalesChannel = 'CARD_PRESENT' | 'CARD_NOT_PRESENT' | 'OMNICHANNEL';

export type AuditAction =
  | 'USER_CREATED'
  | 'LOGIN_SUCCEEDED'
  | 'LOGIN_FAILED'
  | 'USER_LOCKED'
  | 'USER_UNLOCKED'
  | 'USER_ACTIVATED'
  | 'USER_DEACTIVATED'
  | 'PASSWORD_CHANGED'
  | 'TEMPORARY_PASSWORD_ISSUED'
  | 'MERCHANT_PROVISIONED'
  | 'MERCHANT_SETTINGS_UPDATED'
  | 'PAYMENT_REVIEWED'
  | 'APPLICATION_CREATED'
  | 'APPLICATION_UPDATED'
  | 'APPLICATION_SUBMITTED'
  | 'REVIEWER_ASSIGNED'
  | 'RISK_REVIEW_COMPLETED'
  | 'RISK_REVIEW_FAILED'
  | 'RISK_REVIEW_RETRIED'
  | 'REVIEW_DECISION_RECORDED';

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  // Locked after too many wrong passwords; only an admin can unlock.
  isLocked: boolean;
  lockedAt: string | null;
  // Set for merchant portal users.
  merchantId: string | null;
  // A temporary password: nothing but changing it is allowed until then.
  mustChangePassword: boolean;
  createdAt: string;
}

export interface TokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface OwnerContact {
  fullName: string;
  email: string;
  phone: string;
}

export interface ProcessingProfile {
  merchantCategoryCode: string;
  currency: string;
  expectedMonthlyVolumeMinor: number;
  averageTicketMinor: number;
  salesChannel: SalesChannel;
}

export interface MerchantApplication {
  id: string;
  businessName: string;
  legalBusinessName: string;
  businessType: BusinessType;
  taxIdMasked: string;
  owner: OwnerContact;
  processing: ProcessingProfile;
  status: ApplicationStatus;
  riskStatus: RiskStatus;
  riskLevel: RiskLevel | null;
  riskScore: number | null;
  assignedReviewerId: string | null;
  createdById: string;
  submissionCount: number;
  decision: ReviewDecision | null;
  decisionReason: string | null;
  decidedById: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface RiskAssessment {
  id: string;
  applicationId: string;
  submissionNumber: number;
  provider: string;
  providerReference: string;
  score: number;
  level: RiskLevel;
  reasons: string[];
  assessedAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorRole: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  correlationId: string | null;
  occurredAt: string;
}

// Request bodies

export interface BusinessDetailsInput {
  businessName: string;
  legalBusinessName: string;
  businessType: BusinessType;
  taxId: string;
  owner: OwnerContact;
  processing: ProcessingProfile;
}

export type BusinessDetailsPatch = Partial<Omit<BusinessDetailsInput, 'owner' | 'processing'>> & {
  owner?: Partial<OwnerContact>;
  processing?: Partial<ProcessingProfile>;
};

// Shown once after approval: the new merchant owner's first sign-in.
export interface OnboardingCredentials {
  merchantId: string;
  ownerUserId: string;
  ownerEmail: string;
  temporaryPassword: string;
}

export interface DecisionResult extends MerchantApplication {
  onboarding: OnboardingCredentials | null;
}

export interface TemporaryPassword {
  userId: string;
  email: string;
  temporaryPassword: string;
}

// Merchant portal

export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'QR';
export type PaymentStatus = 'PROCESSING' | 'COMPLETED' | 'PENDING_REVIEW' | 'DECLINED' | 'VOIDED';
export type FraudDecision = 'ALLOW' | 'REVIEW' | 'BLOCK';
export type LoyaltyEntryType = 'EARN' | 'REDEEM' | 'RESTORE';

export interface Merchant {
  id: string;
  applicationId: string;
  tradingName: string;
  legalName: string;
  businessType: BusinessType;
  merchantCategoryCode: string;
  currency: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  status: 'ACTIVE' | 'SUSPENDED';
  acceptedMethods: { cash: boolean; card: boolean; bankTransfer: boolean; qr: boolean };
  settlement: { bankName: string; accountHolder: string; accountLast4: string } | null;
  highValueThresholdMinor: number;
  loyalty: { enabled: boolean; earnUnitMinor: number; pointValueMinor: number; maxRedeemPercent: number };
  createdAt: string;
  owner?: { id: string; email: string; fullName: string; isActive: boolean; mustChangePassword: boolean } | null;
}

export interface MerchantSettingsInput {
  contactPhone?: string;
  acceptedMethods?: Partial<{ cash: boolean; card: boolean; bankTransfer: boolean }>;
  highValueThresholdMinor?: number;
  loyalty?: Partial<Merchant['loyalty']>;
  settlementAccount?: { bankName: string; accountHolder: string; accountNumber: string } | null;
}

export interface Category {
  id: string;
  name: string;
  discountPercent: number | null;
  productCount: number;
}

export interface Price {
  listPriceMinor: number;
  discountPercent: number;
  discountMinor: number;
  finalPriceMinor: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  priceMinor: number;
  discountPercent: number | null;
  isActive: boolean;
  categoryId: string | null;
  categoryName: string | null;
  price: Price;
  updatedAt: string;
}

export interface ProductInput {
  name: string;
  sku: string;
  description: string | null;
  priceMinor: number;
  discountPercent: number | null;
  categoryId: string | null;
  isActive: boolean;
}

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  pointsBalance: number;
  totalSpentMinor: number;
  visitCount: number;
  lastPurchaseAt: string | null;
  createdAt: string;
}

export interface LoyaltyEntry {
  id: string;
  type: LoyaltyEntryType;
  points: number;
  balanceAfter: number;
  transactionId: string | null;
  createdAt: string;
}

export interface PaymentLine {
  productId: string | null;
  name: string;
  sku: string;
  unitPriceMinor: number;
  discountPercent: number;
  quantity: number;
  lineTotalMinor: number;
}

export interface Payment {
  id: string;
  reference: string;
  status: PaymentStatus;
  method: PaymentMethod;
  currency: string;
  lines: PaymentLine[];
  subtotalMinor: number;
  discountMinor: number;
  pointsRedeemed: number;
  pointsDiscountMinor: number;
  totalMinor: number;
  amountTenderedMinor: number | null;
  changeMinor: number | null;
  pointsEarned: number;
  instrumentBrand: string | null;
  instrumentLast4: string | null;
  authorizationCode: string | null;
  declineReason: string | null;
  fraud: { score: number; reasons: string[]; decision: FraudDecision };
  cashier: { id: string; name: string };
  customer: { id: string; name: string; phone: string } | null;
  review: { reviewerName: string; reviewedAt: string; note: string | null } | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CheckoutInput {
  items: Array<{ productId: string; quantity: number }>;
  method: PaymentMethod;
  customer?: { phone: string; fullName?: string };
  pointsToRedeem?: number;
  cashTenderedMinor?: number;
  card?: { number: string; expiryMonth: number; expiryYear: number; cvv: string; holderName: string };
  bankTransfer?: { accountNumber: string; pin: string };
}

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
  daily: Array<{ date: string } & SalesTotals>;
  topProducts: Array<{ name: string; quantity: number; revenueMinor: number }>;
  pendingReview: SalesTotals;
  declinedToday: number;
  discountsGivenMinor: number;
  pointsRedeemedMinor: number;
  customersServed: number;
}

export interface DecisionInput {
  decision: ReviewDecision;
  reason?: string;
}

export interface CreateUserInput {
  email: string;
  fullName: string;
  role: Role;
  password: string;
}
