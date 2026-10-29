import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RISK_REVIEW_QUEUE_NAME } from '../merchant-applications/infrastructure/queue/risk-review-queue.constants';
import { HealthController } from './health.controller';

@Module({
  imports: [BullModule.registerQueue({ name: RISK_REVIEW_QUEUE_NAME })],
  controllers: [HealthController],
})
export class HealthModule {}
