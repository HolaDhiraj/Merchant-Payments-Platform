// Mirrors the API's response DTOs (see /api/docs). Kept hand-written and small on purpose:
// the client only declares the fields it actually renders.

export type Role = 'ADMIN' | 'REVIEWER' | 'SALES';

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
