import { Injectable } from '@nestjs/common';
import { TransactionalEntityManager } from '../../../../shared/infrastructure/database/transactional-entity-manager';
import {
  ProcessedWebhookEvent,
  ProcessedWebhookEventRepository,
} from '../../domain/ports/processed-webhook-event.repository';
import { ProcessedWebhookEventOrmEntity } from './processed-webhook-event.orm-entity';

@Injectable()
export class TypeOrmProcessedWebhookEventRepository implements ProcessedWebhookEventRepository {
  constructor(private readonly entityManager: TransactionalEntityManager) {}

  // ON CONFLICT DO NOTHING keeps the surrounding transaction usable when the event is a duplicate.
  async recordIfNew(event: ProcessedWebhookEvent): Promise<boolean> {
    const result = await this.entityManager
      .current()
      .createQueryBuilder()
      .insert()
      .into(ProcessedWebhookEventOrmEntity)
      .values({ ...event })
      .orIgnore()
      .returning(['id'])
      .execute();
    return (result.raw as unknown[]).length === 1;
  }
}
