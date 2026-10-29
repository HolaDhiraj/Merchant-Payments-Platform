import { Inject, Injectable, Logger } from '@nestjs/common';
import { Clock, CLOCK } from '../../../../shared/domain/clock';
import { IdGenerator, ID_GENERATOR } from '../../../../shared/domain/id-generator';
import { BusinessDetails } from '../../domain/model/business-details';
import { RiskAssessment } from '../../domain/model/risk-assessment';
import {
  MERCHANT_APPLICATION_REPOSITORY,
  MerchantApplicationRepository,
} from '../../domain/ports/merchant-application.repository';
import {
  RISK_ASSESSMENT_REPOSITORY,
  RiskAssessmentRepository,
} from '../../domain/ports/risk-assessment.repository';
import { RISK_PROVIDER, RiskProvider } from '../../domain/ports/risk-provider';
import { RiskReviewJob } from '../../domain/ports/risk-review-queue';
import { RiskAssessmentRecorder, RiskResultOutcome } from '../services/risk-assessment-recorder';

export enum RiskReviewOutcome {
  COMPLETED = 'COMPLETED',
  SKIPPED_NOT_FOUND = 'SKIPPED_NOT_FOUND',
  SKIPPED_ALREADY_PROCESSED = 'SKIPPED_ALREADY_PROCESSED',
}

const OUTCOME_BY_RESULT: Record<RiskResultOutcome, RiskReviewOutcome> = {
  [RiskResultOutcome.APPLIED]: RiskReviewOutcome.COMPLETED,
  [RiskResultOutcome.APPLICATION_NOT_FOUND]: RiskReviewOutcome.SKIPPED_NOT_FOUND,
  [RiskResultOutcome.ALREADY_PROCESSED]: RiskReviewOutcome.SKIPPED_ALREADY_PROCESSED,
};

// Worker-side use case: calls the risk provider and applies the result exactly once.
//
// Idempotency is layered:
//  1. Stale or duplicate jobs are skipped when the aggregate is no longer awaiting this submission.
//  2. An assessment already stored for the idempotency key means the result was applied (they commit
//     together), so the job is skipped without calling the vendor again.
//  3. The provider receives the same idempotency key, so it can de-duplicate on its side.
//  4. RiskAssessmentRecorder inserts with ON CONFLICT DO NOTHING on the unique idempotency key and
//     updates the application with optimistic locking, so concurrent workers (or a worker racing a
//     webhook) can apply at most one result.
// Errors thrown from here (provider outage, version conflict) make BullMQ retry with backoff.
@Injectable()
export class ProcessRiskReviewUseCase {
  private readonly logger = new Logger(ProcessRiskReviewUseCase.name);

  constructor(
    @Inject(MERCHANT_APPLICATION_REPOSITORY)
    private readonly applications: MerchantApplicationRepository,
    @Inject(RISK_ASSESSMENT_REPOSITORY)
    private readonly assessments: RiskAssessmentRepository,
    @Inject(RISK_PROVIDER) private readonly provider: RiskProvider,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly recorder: RiskAssessmentRecorder,
  ) {}

  async execute(job: RiskReviewJob): Promise<RiskReviewOutcome> {
    // Cheap pre-check, so duplicate or stale jobs never call the (paid, slow) vendor.
    const application = await this.applications.findById(job.applicationId);
    if (!application) {
      this.logger.warn(`Risk review skipped: application ${job.applicationId} not found`);
      return RiskReviewOutcome.SKIPPED_NOT_FOUND;
    }
    if (!application.isAwaitingRiskReview(job.submissionNumber)) {
      return RiskReviewOutcome.SKIPPED_ALREADY_PROCESSED;
    }

    if (await this.assessments.findByIdempotencyKey(job.idempotencyKey)) {
      return RiskReviewOutcome.SKIPPED_ALREADY_PROCESSED;
    }

    const assessment = await this.requestAssessment(job, application.details);
    return OUTCOME_BY_RESULT[await this.recorder.record(assessment, 'WORKER')];
  }

  private async requestAssessment(
    job: RiskReviewJob,
    details: BusinessDetails,
  ): Promise<RiskAssessment> {
    const response = await this.provider.assess({
      idempotencyKey: job.idempotencyKey,
      applicationId: job.applicationId,
      legalBusinessName: details.legalBusinessName,
      businessType: details.businessType,
      taxId: details.taxId.reveal(),
      merchantCategoryCode: details.processing.merchantCategoryCode,
      currency: details.processing.currency,
      expectedMonthlyVolumeMinor: details.processing.expectedMonthlyVolumeMinor,
      averageTicketMinor: details.processing.averageTicketMinor,
      salesChannel: details.processing.salesChannel,
    });

    return {
      id: this.ids.next(),
      applicationId: job.applicationId,
      submissionNumber: job.submissionNumber,
      idempotencyKey: job.idempotencyKey,
      provider: response.provider,
      providerReference: response.providerReference,
      score: response.score,
      level: response.level,
      reasons: response.reasons,
      assessedAt: this.clock.now(),
    };
  }
}
