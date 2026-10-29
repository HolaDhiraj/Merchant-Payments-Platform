import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'processed_webhook_events' })
export class ProcessedWebhookEventOrmEntity {
  // The provider's event id; the primary key itself enforces once-only processing.
  @PrimaryColumn({ type: 'varchar', length: 100 })
  id: string;

  @Column({ type: 'varchar', length: 50 })
  source: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType: string;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;
}
