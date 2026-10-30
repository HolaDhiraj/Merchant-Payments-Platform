import type {
  ApplicationStatus,
  AuditAction,
  BusinessType,
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

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  REVIEWER: 'Reviewer',
  SALES: 'Sales',
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
  APPLICATION_CREATED: 'Application created',
  APPLICATION_UPDATED: 'Application edited',
  APPLICATION_SUBMITTED: 'Submitted for review',
  REVIEWER_ASSIGNED: 'Reviewer assigned',
  RISK_REVIEW_COMPLETED: 'Risk check completed',
  RISK_REVIEW_FAILED: 'Risk check failed',
  RISK_REVIEW_RETRIED: 'Risk check retried',
  REVIEW_DECISION_RECORDED: 'Decision recorded',
};
