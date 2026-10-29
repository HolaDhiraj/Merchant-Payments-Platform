import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'outbox_messages' })
@Index('idx_outbox_messages_pending', ['availableAt'], { where: 'dispatched_at IS NULL' })
export class OutboxMessageOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  topic: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError: string | null;

  // Earliest time the relay may (re)try this message; pushed back with backoff after failures.
  @Column({ name: 'available_at', type: 'timestamptz' })
  availableAt: Date;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'dispatched_at', type: 'timestamptz', nullable: true })
  dispatchedAt: Date | null;
}
