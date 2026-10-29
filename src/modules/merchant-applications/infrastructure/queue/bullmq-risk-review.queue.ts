import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { riskReviewConfig, RiskReviewConfig } from '../../../../config/app.config';
import { RiskReviewJob, RiskReviewQueue } from '../../domain/ports/risk-review-queue';
import { RISK_REVIEW_JOB_NAME, RISK_REVIEW_QUEUE_NAME } from './risk-review-queue.constants';

// BullMQ adapter for the RiskReviewQueue port.
// The job id is derived from the idempotency key, so enqueuing the same submission twice
// (double click, client retry, admin retry while a job is still waiting) creates only one job.
@Injectable()
export class BullMqRiskReviewQueue implements RiskReviewQueue {
  constructor(
    @InjectQueue(RISK_REVIEW_QUEUE_NAME) private readonly queue: Queue<RiskReviewJob>,
    @Inject(riskReviewConfig.KEY) private readonly config: RiskReviewConfig,
  ) {}

  async enqueue(job: RiskReviewJob): Promise<void> {
    const jobId = BullMqRiskReviewQueue.jobIdFor(job);

    // A finished job with the same id would silently swallow a new add(), so an explicit
    // admin retry first removes the old failed/completed job.
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'failed' || state === 'completed') {
        await existing.remove();
      }
    }

    await this.queue.add(RISK_REVIEW_JOB_NAME, job, {
      jobId,
      attempts: this.config.maxAttempts,
      backoff: { type: 'exponential', delay: this.config.backoffMs },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    });
  }

  // BullMQ does not allow ":" in custom job ids.
  static jobIdFor(job: RiskReviewJob): string {
    return job.idempotencyKey.replace(/:/g, '_');
  }
}
