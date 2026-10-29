import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { DataSource, EntityManager } from 'typeorm';

// Holds the EntityManager of the currently open transaction (if any).
// Repositories always ask this class for a manager, so they automatically join a
// transaction started by the UnitOfWork without the use case passing it around.
@Injectable()
export class TransactionalEntityManager {
  private readonly storage = new AsyncLocalStorage<EntityManager>();

  constructor(private readonly dataSource: DataSource) {}

  // Returns the transaction-scoped manager, or the default manager outside a transaction.
  current(): EntityManager {
    return this.storage.getStore() ?? this.dataSource.manager;
  }

  runWith<T>(manager: EntityManager, work: () => Promise<T>): Promise<T> {
    return this.storage.run(manager, work);
  }

  isInTransaction(): boolean {
    return this.storage.getStore() !== undefined;
  }
}
