import {
  BusinessRuleViolationError,
  InvalidStateTransitionError,
} from '../../../../shared/domain/domain-errors';
import { ApplicationLifecycle } from './application-lifecycle';
import { ApplicationStatus } from './application-status.enum';
import { assertValidBusinessDetails, BusinessDetails } from './business-details';
import { ReviewDecision } from './review-decision.enum';
import { RiskLevel, RiskStatus } from './risk.enums';

export interface MerchantApplicationProps {
  id: string;
  createdById: string;
  details: BusinessDetails;
  status: ApplicationStatus;
  riskStatus: RiskStatus;
  riskLevel: RiskLevel | null;
  riskScore: number | null;
  assignedReviewerId: string | null;
  // Increments on every (re-)submission; part of the risk-review idempotency key.
  submissionCount: number;
  decision: ReviewDecision | null;
  decisionReason: string | null;
  decidedById: string | null;
  submittedAt: Date | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Optimistic-locking version, managed by the repository.
  version: number;
}

export interface RiskReviewResult {
  submissionNumber: number;
  level: RiskLevel;
  score: number;
}

export interface DecisionInput {
  reviewerId: string;
  decision: ReviewDecision;
  reason?: string | null;
}

const DECISION_TARGET_STATUS: Record<ReviewDecision, ApplicationStatus> = {
  [ReviewDecision.APPROVE]: ApplicationStatus.APPROVED,
  [ReviewDecision.REJECT]: ApplicationStatus.REJECTED,
  [ReviewDecision.REQUEST_INFO]: ApplicationStatus.INFO_REQUESTED,
};

// Aggregate root for merchant onboarding. All state changes go through its methods,
// which enforce the lifecycle and business rules; persistence and HTTP are not its concern.
export class MerchantApplication {
  private constructor(private props: MerchantApplicationProps) {}

  static create(params: {
    id: string;
    createdById: string;
    details: BusinessDetails;
    now: Date;
  }): MerchantApplication {
    assertValidBusinessDetails(params.details);
    return new MerchantApplication({
      id: params.id,
      createdById: params.createdById,
      details: params.details,
      status: ApplicationStatus.DRAFT,
      riskStatus: RiskStatus.NOT_STARTED,
      riskLevel: null,
      riskScore: null,
      assignedReviewerId: null,
      submissionCount: 0,
      decision: null,
      decisionReason: null,
      decidedById: null,
      submittedAt: null,
      decidedAt: null,
      createdAt: params.now,
      updatedAt: params.now,
      version: 0,
    });
  }

  // Rebuilds an aggregate from persistence without re-running creation rules.
  static restore(props: MerchantApplicationProps): MerchantApplication {
    return new MerchantApplication({ ...props });
  }

  // Idempotency key for one risk review of one submission. Redelivered or duplicated jobs
  // for the same submission share the key, so they cannot produce a second result.
  static riskReviewIdempotencyKey(applicationId: string, submissionNumber: number): string {
    return `risk-review:${applicationId}:${submissionNumber}`;
  }

  // Read accessors

  get id(): string {
    return this.props.id;
  }
  get createdById(): string {
    return this.props.createdById;
  }
  get details(): BusinessDetails {
    return this.props.details;
  }
  get status(): ApplicationStatus {
    return this.props.status;
  }
  get riskStatus(): RiskStatus {
    return this.props.riskStatus;
  }
  get riskLevel(): RiskLevel | null {
    return this.props.riskLevel;
  }
  get riskScore(): number | null {
    return this.props.riskScore;
  }
  get assignedReviewerId(): string | null {
    return this.props.assignedReviewerId;
  }
  get submissionCount(): number {
    return this.props.submissionCount;
  }
  get decision(): ReviewDecision | null {
    return this.props.decision;
  }
  get decisionReason(): string | null {
    return this.props.decisionReason;
  }
  get decidedById(): string | null {
    return this.props.decidedById;
  }
  get submittedAt(): Date | null {
    return this.props.submittedAt;
  }
  get decidedAt(): Date | null {
    return this.props.decidedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get version(): number {
    return this.props.version;
  }

  isEditable(): boolean {
    return ApplicationLifecycle.isEditable(this.props.status);
  }

  // True only while this exact submission is waiting for its risk result.
  isAwaitingRiskReview(submissionNumber: number): boolean {
    return (
      this.props.status === ApplicationStatus.SUBMITTED &&
      this.props.riskStatus === RiskStatus.PENDING &&
      this.props.submissionCount === submissionNumber
    );
  }

  // Behaviour

  // Sales edits are allowed only in DRAFT or INFO_REQUESTED.
  updateDetails(changes: Partial<BusinessDetails>, now: Date): void {
    if (!this.isEditable()) {
      throw new InvalidStateTransitionError(this.props.status, 'edit');
    }
    const details: BusinessDetails = {
      ...this.props.details,
      ...changes,
      owner: { ...this.props.details.owner, ...changes.owner },
      processing: { ...this.props.details.processing, ...changes.processing },
    };
    assertValidBusinessDetails(details);
    this.props.details = details;
    this.touch(now);
  }

  // Sends the application to risk review. Returns the submission number for the job.
  submit(now: Date): number {
    ApplicationLifecycle.assertTransition(this.props.status, ApplicationStatus.SUBMITTED, 'submit');
    assertValidBusinessDetails(this.props.details);

    this.props.status = ApplicationStatus.SUBMITTED;
    this.props.riskStatus = RiskStatus.PENDING;
    this.props.riskLevel = null;
    this.props.riskScore = null;
    this.props.submissionCount += 1;
    this.props.submittedAt = now;
    // A previous REQUEST_INFO decision no longer applies once the merchant resubmits.
    this.props.decision = null;
    this.props.decisionReason = null;
    this.props.decidedById = null;
    this.props.decidedAt = null;
    this.touch(now);
    return this.props.submissionCount;
  }

  // Assigns (or re-assigns) the reviewer. Not possible once a final decision exists.
  assignReviewer(reviewerId: string, now: Date): void {
    if (ApplicationLifecycle.isTerminal(this.props.status)) {
      throw new InvalidStateTransitionError(this.props.status, 'assign a reviewer to');
    }
    this.props.assignedReviewerId = reviewerId;
    this.touch(now);
  }

  // Applies the risk provider's result. Returns false (and changes nothing) when the result is
  // stale or already applied, which makes duplicate job deliveries harmless.
  completeRiskReview(result: RiskReviewResult, now: Date): boolean {
    if (!this.isAwaitingRiskReview(result.submissionNumber)) {
      return false;
    }
    if (!Number.isInteger(result.score) || result.score < 0 || result.score > 100) {
      throw new BusinessRuleViolationError('Risk score must be an integer between 0 and 100');
    }
    ApplicationLifecycle.assertTransition(
      this.props.status,
      ApplicationStatus.UNDER_REVIEW,
      'complete risk review for',
    );
    this.props.status = ApplicationStatus.UNDER_REVIEW;
    this.props.riskStatus = RiskStatus.COMPLETED;
    this.props.riskLevel = result.level;
    this.props.riskScore = result.score;
    this.touch(now);
    return true;
  }

  // Marks the risk check as failed after retries are exhausted. Application stays SUBMITTED
  // so an admin can retry; it can never be approved without a risk result.
  failRiskReview(submissionNumber: number, now: Date): boolean {
    if (!this.isAwaitingRiskReview(submissionNumber)) {
      return false;
    }
    this.props.riskStatus = RiskStatus.FAILED;
    this.touch(now);
    return true;
  }

  // Puts a failed (or stuck pending) risk check back in the queue for the same submission.
  restartRiskReview(now: Date): number {
    const canRestart =
      this.props.status === ApplicationStatus.SUBMITTED &&
      (this.props.riskStatus === RiskStatus.FAILED || this.props.riskStatus === RiskStatus.PENDING);
    if (!canRestart) {
      throw new InvalidStateTransitionError(
        `${this.props.status}/${this.props.riskStatus}`,
        'retry risk review for',
      );
    }
    this.props.riskStatus = RiskStatus.PENDING;
    this.touch(now);
    return this.props.submissionCount;
  }

  // Records the assigned reviewer's decision. Who may call this is checked by the access policy;
  // the aggregate re-checks the assignment as a last line of defence.
  recordDecision(input: DecisionInput, now: Date): void {
    if (this.props.assignedReviewerId !== input.reviewerId) {
      throw new BusinessRuleViolationError('Only the assigned reviewer can record a decision');
    }
    const target = DECISION_TARGET_STATUS[input.decision];
    ApplicationLifecycle.assertTransition(this.props.status, target, 'record a decision on');
    if (this.props.riskStatus !== RiskStatus.COMPLETED) {
      throw new BusinessRuleViolationError('A decision requires a completed risk review');
    }

    const reason = input.reason?.trim() || null;
    if (input.decision !== ReviewDecision.APPROVE && !reason) {
      throw new BusinessRuleViolationError('A reason is required to reject or request information');
    }
    if (
      input.decision === ReviewDecision.APPROVE &&
      this.props.riskLevel === RiskLevel.HIGH &&
      !reason
    ) {
      throw new BusinessRuleViolationError(
        'Approving a HIGH risk merchant requires a justification',
      );
    }

    this.props.status = target;
    this.props.decision = input.decision;
    this.props.decisionReason = reason;
    this.props.decidedById = input.reviewerId;
    this.props.decidedAt = now;
    this.touch(now);
  }

  // Persistence-only: called by the repository after a successful versioned write.
  syncVersion(version: number): void {
    this.props.version = version;
  }

  private touch(now: Date): void {
    this.props.updatedAt = now;
  }
}
