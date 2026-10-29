import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { ProcessRiskReviewUseCase } from '../../application/use-cases/process-risk-review.use-case';
import { MarkRiskReviewFailedUseCase } from '../../application/use-cases/mark-risk-review-failed.use-case';
import { PermanentRiskProviderError } from '../../domain/ports/risk-provider';
import { RiskReviewJob } from '../../domain/ports/risk-review-queue';
import { RISK_REVIEW_QUEUE_NAME } from './risk-review-queue.constants';
import { RequestContext } from '../../../../shared/infrastructure/request-context/request-context';

// BullMQ worker. A thin adapter: it translates queue concerns (attempts, unrecoverable errors)
// and delegates all business logic to use cases.
@Processor(RISK_REVIEW_QUEUE_NAME, { concurrency: 5 })
export class RiskReviewProcessor extends WorkerHost {
  private readonly logger = new Logger(RiskReviewProcessor.name);

  constructor(
    private readonly processRiskReview: ProcessRiskReviewUseCase,
    private readonly markRiskReviewFailed: MarkRiskReviewFailedUseCase,
  ) {
    super();
  }

  async process(job: Job<RiskReviewJob>): Promise<string> {
    // Re-establish the originating request's correlation id, so audit entries written by the
    // worker can be joined with the HTTP request that submitted the application.
    const correlationId = job.data.correlationId ?? String(job.id);
    return RequestContext.run({ correlationId }, () => this.processInContext(job));
  }

  private async processInContext(job: Job<RiskReviewJob>): Promise<string> {
    try {
      const outcome = await this.processRiskReview.execute(job.data);
      this.logger.log(`Risk review job ${job.id} attempt ${job.attemptsMade + 1}: ${outcome}`);
      return outcome;
    } catch (error) {
      // Retrying cannot fix a permanent rejection, so skip the remaining attempts.
      if (error instanceof PermanentRiskProviderError) {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  }

  // Runs after every failed attempt; acts only when no retry is left.
  @OnWorkerEvent('failed')
  async onFailed(job: Job<RiskReviewJob> | undefined, error: Error): Promise<void> {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    const exhausted = job.attemptsMade >= maxAttempts || error instanceof UnrecoverableError;
    this.logger.warn(
      `Risk review job ${job.id} failed (attempt ${job.attemptsMade}/${maxAttempts}): ${error.name}`,
    );
    if (!exhausted) return;

    try {
      const correlationId = job.data.correlationId ?? String(job.id);
      await RequestContext.run({ correlationId }, () =>
        this.markRiskReviewFailed.execute(
          job.data,
          `${error.name}: ${error.message}`,
          job.attemptsMade,
        ),
      );
    } catch (markError) {
      this.logger.error(
        `Could not mark risk review ${job.id} as failed`,
        markError instanceof Error ? markError.stack : undefined,
      );
    }
  }
}
