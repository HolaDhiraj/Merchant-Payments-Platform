import { RiskAssessment } from '../model/risk-assessment';

// Persistence port for risk results.
export interface RiskAssessmentRepository {
  findByIdempotencyKey(idempotencyKey: string): Promise<RiskAssessment | null>;
  findLatestByApplicationId(applicationId: string): Promise<RiskAssessment | null>;
  // Inserts unless an assessment with the same idempotency key exists. Returns false for a duplicate.
  // Never throws on duplicates, so it is safe inside a larger transaction.
  insertIfAbsent(assessment: RiskAssessment): Promise<boolean>;
}

export const RISK_ASSESSMENT_REPOSITORY = Symbol('RISK_ASSESSMENT_REPOSITORY');
