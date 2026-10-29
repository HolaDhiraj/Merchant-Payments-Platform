import { Inject, Injectable } from '@nestjs/common';
import { OUTBOX, Outbox } from '../../../../shared/application/outbox';
import { RequestContext } from '../../../../shared/infrastructure/request-context/request-context';
import { MerchantApplication } from '../../domain/model/merchant-application';
import { RISK_REVIEW_REQUESTED_TOPIC, RiskReviewJob } from '../../domain/ports/risk-review-queue';

// Requests a risk review through the transactional outbox.
// Must be called inside the same UnitOfWork as the state change: the request is stored with the
// change, and the OutboxRelay publishes it to BullMQ after commit. A Redis outage therefore only
// delays the review; it can never lose it or publish a job for a rolled-back change.
@Injectable()
export class RiskReviewScheduler {
  constructor(@Inject(OUTBOX) private readonly outbox: Outbox) {}

  async schedule(applicationId: string, submissionNumber: number): Promise<void> {
    const job: RiskReviewJob = {
      applicationId,
      submissionNumber,
      idempotencyKey: MerchantApplication.riskReviewIdempotencyKey(applicationId, submissionNumber),
      correlationId: RequestContext.correlationId() ?? null,
    };
    await this.outbox.add({ topic: RISK_REVIEW_REQUESTED_TOPIC, payload: { ...job } });
  }
}
