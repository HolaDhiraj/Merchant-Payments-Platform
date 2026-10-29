// Message placed on the queue. It holds identifiers only, never merchant personal data,
// because queue payloads are stored in Redis and are visible in queue tooling.
export interface RiskReviewJob {
  applicationId: string;
  submissionNumber: number;
  idempotencyKey: string;
  // Correlation id of the HTTP request that caused the review, so worker audit entries
  // can be traced back to it.
  correlationId?: string | null;
}

// Port for scheduling the asynchronous risk review (BullMQ in infrastructure).
export interface RiskReviewQueue {
  enqueue(job: RiskReviewJob): Promise<void>;
}

export const RISK_REVIEW_QUEUE = Symbol('RISK_REVIEW_QUEUE');

// Outbox topic used to request a risk review after the submitting transaction commits.
export const RISK_REVIEW_REQUESTED_TOPIC = 'risk-review.requested';
