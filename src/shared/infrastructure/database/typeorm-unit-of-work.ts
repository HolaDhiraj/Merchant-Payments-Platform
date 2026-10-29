import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UnitOfWork } from '../../application/unit-of-work';
import { TransactionalEntityManager } from './transactional-entity-manager';

// TypeORM implementation of the UnitOfWork port.
// Nested calls reuse the outer transaction instead of opening a new one.
@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(
    private readonly dataSource: DataSource,
    private readonly transactionalEntityManager: TransactionalEntityManager,
  ) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    if (this.transactionalEntityManager.isInTransaction()) {
      return work();
    }
    return this.dataSource.transaction((manager) =>
      this.transactionalEntityManager.runWith(manager, work),
    );
  }
}
