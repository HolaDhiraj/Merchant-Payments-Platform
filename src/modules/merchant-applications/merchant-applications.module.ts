import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { MerchantsModule } from '../merchants/merchants.module';
import { OnboardApprovedApplicationUseCase } from './application/use-cases/onboard-approved-application.use-case';
import { MERCHANT_APPLICATION_REPOSITORY } from './domain/ports/merchant-application.repository';
import { RISK_ASSESSMENT_REPOSITORY } from './domain/ports/risk-assessment.repository';
import { RISK_REVIEW_QUEUE } from './domain/ports/risk-review-queue';
import { RISK_PROVIDER } from './domain/ports/risk-provider';
import { MerchantApplicationOrmEntity } from './infrastructure/persistence/merchant-application.orm-entity';
import { RiskAssessmentOrmEntity } from './infrastructure/persistence/risk-assessment.orm-entity';
import { MerchantApplicationMapper } from './infrastructure/persistence/merchant-application.mapper';
import { TypeOrmMerchantApplicationRepository } from './infrastructure/persistence/typeorm-merchant-application.repository';
import { TypeOrmRiskAssessmentRepository } from './infrastructure/persistence/typeorm-risk-assessment.repository';
import { BullMqRiskReviewQueue } from './infrastructure/queue/bullmq-risk-review.queue';
import { RiskReviewProcessor } from './infrastructure/queue/risk-review.processor';
import { RISK_REVIEW_QUEUE_NAME } from './infrastructure/queue/risk-review-queue.constants';
import { SimulatedKybRiskProvider } from './infrastructure/risk-provider/simulated-kyb-risk.provider';
import { MerchantApplicationReader } from './application/services/merchant-application-reader';
import { RiskReviewScheduler } from './application/services/risk-review-scheduler';
import { CreateMerchantApplicationUseCase } from './application/use-cases/create-merchant-application.use-case';
import { UpdateMerchantApplicationUseCase } from './application/use-cases/update-merchant-application.use-case';
import { GetMerchantApplicationUseCase } from './application/use-cases/get-merchant-application.use-case';
import { ListMerchantApplicationsUseCase } from './application/use-cases/list-merchant-applications.use-case';
import { SubmitMerchantApplicationUseCase } from './application/use-cases/submit-merchant-application.use-case';
import { AssignReviewerUseCase } from './application/use-cases/assign-reviewer.use-case';
import { RecordReviewDecisionUseCase } from './application/use-cases/record-review-decision.use-case';
import { ProcessRiskReviewUseCase } from './application/use-cases/process-risk-review.use-case';
import { MarkRiskReviewFailedUseCase } from './application/use-cases/mark-risk-review-failed.use-case';
import { RetryRiskReviewUseCase } from './application/use-cases/retry-risk-review.use-case';
import { GetRiskAssessmentUseCase } from './application/use-cases/get-risk-assessment.use-case';
import { MerchantApplicationsController } from './presentation/merchant-applications.controller';
import { RiskAssessmentRecorder } from './application/services/risk-assessment-recorder';
import { HandleRiskProviderWebhookUseCase } from './application/use-cases/handle-risk-provider-webhook.use-case';
import { PROCESSED_WEBHOOK_EVENT_REPOSITORY } from './domain/ports/processed-webhook-event.repository';
import { ProcessedWebhookEventOrmEntity } from './infrastructure/webhooks/processed-webhook-event.orm-entity';
import { TypeOrmProcessedWebhookEventRepository } from './infrastructure/webhooks/typeorm-processed-webhook-event.repository';
import { HmacWebhookSignatureVerifier } from './infrastructure/webhooks/hmac-webhook-signature.verifier';
import { RiskReviewOutboxHandler } from './infrastructure/queue/risk-review-outbox.handler';
import { RiskWebhookSignatureGuard } from './presentation/webhooks/risk-webhook-signature.guard';
import { RiskProviderWebhookController } from './presentation/webhooks/risk-provider-webhook.controller';

// Composition root of the merchant-application feature: binds every domain port to its adapter.
// Replacing the simulated KYB provider with a real vendor means changing only the RISK_PROVIDER line.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MerchantApplicationOrmEntity,
      RiskAssessmentOrmEntity,
      ProcessedWebhookEventOrmEntity,
    ]),
    BullModule.registerQueue({ name: RISK_REVIEW_QUEUE_NAME }),
    AuditModule,
    UsersModule,
    MerchantsModule,
  ],
  controllers: [MerchantApplicationsController, RiskProviderWebhookController],
  providers: [
    // Ports -> adapters
    { provide: MERCHANT_APPLICATION_REPOSITORY, useClass: TypeOrmMerchantApplicationRepository },
    { provide: RISK_ASSESSMENT_REPOSITORY, useClass: TypeOrmRiskAssessmentRepository },
    { provide: RISK_REVIEW_QUEUE, useClass: BullMqRiskReviewQueue },
    { provide: RISK_PROVIDER, useClass: SimulatedKybRiskProvider },
    {
      provide: PROCESSED_WEBHOOK_EVENT_REPOSITORY,
      useClass: TypeOrmProcessedWebhookEventRepository,
    },
    MerchantApplicationMapper,

    // Application services and use cases
    MerchantApplicationReader,
    RiskReviewScheduler,
    RiskAssessmentRecorder,
    CreateMerchantApplicationUseCase,
    UpdateMerchantApplicationUseCase,
    GetMerchantApplicationUseCase,
    ListMerchantApplicationsUseCase,
    SubmitMerchantApplicationUseCase,
    AssignReviewerUseCase,
    RecordReviewDecisionUseCase,
    OnboardApprovedApplicationUseCase,
    ProcessRiskReviewUseCase,
    MarkRiskReviewFailedUseCase,
    RetryRiskReviewUseCase,
    GetRiskAssessmentUseCase,
    HandleRiskProviderWebhookUseCase,

    // Webhook security
    HmacWebhookSignatureVerifier,
    RiskWebhookSignatureGuard,

    // Background processing: outbox delivery to BullMQ, and the BullMQ worker
    RiskReviewOutboxHandler,
    RiskReviewProcessor,
  ],
})
export class MerchantApplicationsModule {}
