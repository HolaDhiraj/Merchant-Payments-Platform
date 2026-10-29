import { RiskLevel } from './risk.enums';

// Persisted result of one risk / KYB check. The unique idempotency key guarantees
// at most one assessment per application submission.
export interface RiskAssessment {
  readonly id: string;
  readonly applicationId: string;
  readonly submissionNumber: number;
  readonly idempotencyKey: string;
  readonly provider: string;
  readonly providerReference: string;
  readonly score: number;
  readonly level: RiskLevel;
  readonly reasons: string[];
  readonly assessedAt: Date;
}
