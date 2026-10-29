import { Inject, Injectable } from '@nestjs/common';
import { Clock, CLOCK } from '../../../../shared/domain/clock';
import { IdGenerator, ID_GENERATOR } from '../../../../shared/domain/id-generator';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/application/unit-of-work';
import { MerchantApplication } from '../../domain/model/merchant-application';
import { RiskLevel } from '../../domain/model/risk.enums';
import {
  PROCESSED_WEBHOOK_EVENT_REPOSITORY,
  ProcessedWebhookEventRepository,
} from '../../domain/ports/processed-webhook-event.repository';
import { RiskAssessmentRecorder, RiskResultOutcome } from '../services/risk-assessment-recorder';

export const RISK_WEBHOOK_SOURCE = 'risk-provider';
export const RISK_ASSESSMENT_COMPLETED_EVENT = 'risk_assessment.completed';

export interface RiskProviderWebhookEvent {
  eventId: string;
  eventType: string;
  applicationId: string;
  submissionNumber: number;
  provider: string;
  providerReference: string;
  score: number;
  level: RiskLevel;
  reasons: string[];
  assessedAt: Date;
}

export type WebhookOutcome = RiskResultOutcome | 'DUPLICATE_EVENT';

// Handles an asynchronous result pushed by the risk vendor (an alternative to the worker polling it).
//
// Event de-duplication and result application share one transaction: if applying fails
// (e.g. optimistic-lock conflict) the event is not marked processed, the endpoint returns 5xx
// and the provider's retry will process it again. Results for unknown or already-reviewed
// applications are acknowledged (2xx) so the provider stops retrying something we cannot use.
@Injectable()
export class HandleRiskProviderWebhookUseCase {
  constructor(
    @Inject(PROCESSED_WEBHOOK_EVENT_REPOSITORY)
    private readonly processedEvents: ProcessedWebhookEventRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly recorder: RiskAssessmentRecorder,
  ) {}

  execute(event: RiskProviderWebhookEvent): Promise<WebhookOutcome> {
    return this.unitOfWork.run(async () => {
      const isNew = await this.processedEvents.recordIfNew({
        id: event.eventId,
        source: RISK_WEBHOOK_SOURCE,
        eventType: event.eventType,
        receivedAt: this.clock.now(),
      });
      if (!isNew) {
        return 'DUPLICATE_EVENT';
      }

      // Same idempotency key as the worker path, so a webhook racing the worker cannot
      // produce a second result for the same submission.
      return this.recorder.record(
        {
          id: this.ids.next(),
          applicationId: event.applicationId,
          submissionNumber: event.submissionNumber,
          idempotencyKey: MerchantApplication.riskReviewIdempotencyKey(
            event.applicationId,
            event.submissionNumber,
          ),
          provider: event.provider,
          providerReference: event.providerReference,
          score: event.score,
          level: event.level,
          reasons: event.reasons,
          assessedAt: event.assessedAt,
        },
        'WEBHOOK',
      );
    });
  }
}
