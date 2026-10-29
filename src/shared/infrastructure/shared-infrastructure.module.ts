import { Global, Module } from '@nestjs/common';
import { CLOCK, SystemClock } from '../domain/clock';
import { ID_GENERATOR, UuidGenerator } from '../domain/id-generator';
import { UNIT_OF_WORK } from '../application/unit-of-work';
import { TransactionalEntityManager } from './database/transactional-entity-manager';
import { TypeOrmUnitOfWork } from './database/typeorm-unit-of-work';
import { FIELD_CIPHER } from '../security/field-cipher';
import { AesGcmFieldCipher } from '../security/aes-gcm-field-cipher';
import { OUTBOX } from '../application/outbox';
import { TypeOrmOutbox } from './outbox/typeorm-outbox';
import { OutboxHandlerRegistry } from './outbox/outbox-handler.registry';
import { OutboxRelay } from './outbox/outbox-relay';

// Cross-cutting technical services shared by every feature module
// (transactions, outbox, clock, ids, field encryption).
@Global()
@Module({
  providers: [
    TransactionalEntityManager,
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: UuidGenerator },
    { provide: FIELD_CIPHER, useClass: AesGcmFieldCipher },
    { provide: OUTBOX, useClass: TypeOrmOutbox },
    OutboxHandlerRegistry,
    OutboxRelay,
  ],
  exports: [
    TransactionalEntityManager,
    UNIT_OF_WORK,
    CLOCK,
    ID_GENERATOR,
    FIELD_CIPHER,
    OUTBOX,
    OutboxHandlerRegistry,
    OutboxRelay,
  ],
})
export class SharedInfrastructureModule {}
