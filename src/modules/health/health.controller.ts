import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { Public } from '../../shared/presentation/decorators/public.decorator';
import { RISK_REVIEW_QUEUE_NAME } from '../merchant-applications/infrastructure/queue/risk-review-queue.constants';

// Readiness probe: verifies PostgreSQL and Redis are reachable. Exposes no internal details.
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue(RISK_REVIEW_QUEUE_NAME) private readonly queue: Queue,
  ) {}

  @Public()
  @Get()
  @ApiOkResponse({ description: 'All dependencies reachable' })
  @ApiServiceUnavailableResponse({ description: 'A dependency is down' })
  async check(): Promise<{ status: 'ok'; database: 'up'; redis: 'up' }> {
    try {
      await this.dataSource.query('SELECT 1');
      // Any lightweight queue command proves the Redis connection works.
      await this.queue.getJobCounts('waiting');
      return { status: 'ok', database: 'up', redis: 'up' };
    } catch {
      throw new ServiceUnavailableException('Dependency check failed');
    }
  }
}
