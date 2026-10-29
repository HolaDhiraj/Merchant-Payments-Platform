import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { OutboxMessageHandler } from '../../../../shared/application/outbox';
import { OutboxHandlerRegistry } from '../../../../shared/infrastructure/outbox/outbox-handler.registry';
import {
  RISK_REVIEW_QUEUE,
  RISK_REVIEW_REQUESTED_TOPIC,
  RiskReviewJob,
  RiskReviewQueue,
} from '../../domain/ports/risk-review-queue';

// Delivers "risk review requested" outbox messages to the BullMQ queue.
// Safe to deliver twice: the queue adapter uses a deterministic job id.
@Injectable()
export class RiskReviewOutboxHandler implements OutboxMessageHandler, OnModuleInit {
  readonly topic = RISK_REVIEW_REQUESTED_TOPIC;

  constructor(
    private readonly registry: OutboxHandlerRegistry,
    @Inject(RISK_REVIEW_QUEUE) private readonly queue: RiskReviewQueue,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handle(payload: Record<string, unknown>): Promise<void> {
    await this.queue.enqueue(payload as unknown as RiskReviewJob);
  }
}
