import type {
  ApplicationStatus,
  AuditAction,
  BusinessType,
  FraudDecision,
  LoyaltyEntryType,
  MerchantRole,
  PaymentMethod,
  PaymentStatus,
  PlatformRole,
  ReviewDecision,
  RiskLevel,
  Role,
  SalesChannel,
} from '@/api/types';

// Human wording for API enums, kept in one place so screens stay consistent.

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'In review',
  INFO_REQUESTED: 'Info requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const STATUS_ORDER: ApplicationStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'INFO_REQUESTED',
  'APPROVED',
  'REJECTED',
];

export const RISK_LABEL: Record<RiskLevel, string> = {
  LOW: 'Low risk',
  MEDIUM: 'Medium risk',
  HIGH: 'High risk',
};

export const DECISION_LABEL: Record<ReviewDecision, string> = {
  APPROVE: 'Approved',
  REJECT: 'Rejected',
  REQUEST_INFO: 'More information requested',
};

export const PLATFORM_ROLE_LABEL: Record<PlatformRole, string> = {
  ADMIN: 'Admin',
  REVIEWER: 'Reviewer',
  SALES: 'Sales',
};

export const MERCHANT_ROLE_LABEL: Record<MerchantRole, string> = {
  MERCHANT_ADMIN: 'Owner / admin',
  MERCHANT_SALES: 'Sales',
  MERCHANT_REVIEWER: 'Reviewer',
};

export const MERCHANT_ROLE_DESCRIPTION: Record<MerchantRole, string> = {
  MERCHANT_ADMIN: 'Everything: products, payments, team and settings.',
  MERCHANT_SALES: 'Takes payments and looks after customers; sees their own sales.',
  MERCHANT_REVIEWER: 'Reviews payments held by fraud checks and reads the reports.',
};

export const ROLE_LABEL: Record<Role, string> = { ...PLATFORM_ROLE_LABEL, ...MERCHANT_ROLE_LABEL };

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PROCESSING: 'Processing',
  COMPLETED: 'Paid',
  PENDING_REVIEW: 'Held for review',
  DECLINED: 'Declined',
  VOIDED: 'Voided',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank transfer',
  QR: 'QR',
};

export const FRAUD_DECISION_LABEL: Record<FraudDecision, string> = {
  ALLOW: 'Passed',
  REVIEW: 'Needs review',
  BLOCK: 'Blocked',
};

// Fraud reason codes from the API, in words a shop owner understands.
export const FRAUD_REASON_LABEL: Record<string, string> = {
  HIGH_AMOUNT: 'Amount at or above your high-value threshold',
  VERY_HIGH_AMOUNT: 'Amount at least 3× your high-value threshold',
  NEW_CUSTOMER_LARGE_AMOUNT: 'First purchase by this customer, and a large one',
  MANUALLY_ENTERED_CARD: 'Card details typed in by hand',
  INSTRUMENT_VELOCITY: 'Same card or account used 3+ times in 10 minutes',
  REPEATED_DECLINES: 'Same card or account declined twice in 30 minutes',
  CUSTOMER_VELOCITY: 'Same customer paid 4+ times in 10 minutes',
};

export const LOYALTY_ENTRY_LABEL: Record<LoyaltyEntryType, string> = {
  EARN: 'Earned',
  REDEEM: 'Used',
  RESTORE: 'Returned',
};

export const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  SOLE_PROPRIETORSHIP: 'Sole proprietorship',
  PARTNERSHIP: 'Partnership',
  LLC: 'LLC',
  CORPORATION: 'Corporation',
  NON_PROFIT: 'Non-profit',
};

export const SALES_CHANNEL_LABEL: Record<SalesChannel, string> = {
  CARD_PRESENT: 'In person (card present)',
  CARD_NOT_PRESENT: 'Online (card not present)',
  OMNICHANNEL: 'Both in person and online',
};

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  USER_CREATED: 'User created',
  LOGIN_SUCCEEDED: 'Signed in',
  LOGIN_FAILED: 'Sign-in failed',
  USER_LOCKED: 'Account locked',
  USER_UNLOCKED: 'Account unlocked',
  USER_ACTIVATED: 'Account reactivated',
  USER_DEACTIVATED: 'Account deactivated',
  PASSWORD_CHANGED: 'Password changed',
  TEMPORARY_PASSWORD_ISSUED: 'Temporary password issued',
  MERCHANT_PROVISIONED: 'Merchant account opened',
  MERCHANT_SETTINGS_UPDATED: 'Merchant settings changed',
  PAYMENT_REVIEWED: 'Held payment reviewed',
  APPLICATION_CREATED: 'Application created',
  APPLICATION_UPDATED: 'Application edited',
  APPLICATION_SUBMITTED: 'Submitted for review',
  REVIEWER_ASSIGNED: 'Reviewer assigned',
  RISK_REVIEW_COMPLETED: 'Risk check completed',
  RISK_REVIEW_FAILED: 'Risk check failed',
  RISK_REVIEW_RETRIED: 'Risk check retried',
  REVIEW_DECISION_RECORDED: 'Decision recorded',
};
