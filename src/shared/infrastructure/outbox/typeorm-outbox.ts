import { Inject, Injectable } from '@nestjs/common';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Outbox, OutboxMessage } from '../../application/outbox';
import { Clock, CLOCK } from '../../domain/clock';
import { IdGenerator, ID_GENERATOR } from '../../domain/id-generator';
import { TransactionalEntityManager } from '../database/transactional-entity-manager';
import { OutboxMessageOrmEntity } from './outbox-message.orm-entity';

// Stores outbox messages through the transaction-scoped EntityManager.
// Refuses to run outside a transaction: without one the outbox guarantee would silently disappear.
@Injectable()
export class TypeOrmOutbox implements Outbox {
  constructor(
    private readonly entityManager: TransactionalEntityManager,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async add(message: OutboxMessage): Promise<void> {
    if (!this.entityManager.isInTransaction()) {
      throw new Error('Outbox.add must be called inside a UnitOfWork transaction');
    }
    const now = this.clock.now();
    // The cast is needed only because TypeORM's deep-partial type does not model free-form jsonb.
    const row = {
      id: this.ids.next(),
      topic: message.topic,
      payload: message.payload,
      attempts: 0,
      lastError: null,
      availableAt: now,
      createdAt: now,
      dispatchedAt: null,
    } as QueryDeepPartialEntity<OutboxMessageOrmEntity>;
    await this.entityManager.current().getRepository(OutboxMessageOrmEntity).insert(row);
  }
}
