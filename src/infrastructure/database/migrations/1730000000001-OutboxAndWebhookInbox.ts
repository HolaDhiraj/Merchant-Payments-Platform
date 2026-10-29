import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds the transactional outbox and the webhook inbox.
//  - outbox_messages: events written in the same transaction as business changes and published
//    afterwards by OutboxRelay. The partial index only covers undelivered rows, so it stays small.
//  - processed_webhook_events: provider event ids already handled; the primary key enforces
//    once-only processing of webhook deliveries.
export class OutboxAndWebhookInbox1730000000001 implements MigrationInterface {
  name = 'OutboxAndWebhookInbox1730000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "outbox_messages" (
        "id" uuid PRIMARY KEY,
        "topic" varchar(100) NOT NULL,
        "payload" jsonb NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "last_error" varchar(500),
        "available_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "dispatched_at" timestamptz,
        CONSTRAINT "chk_outbox_attempts" CHECK ("attempts" >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_outbox_messages_pending" ON "outbox_messages" ("available_at") WHERE "dispatched_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "processed_webhook_events" (
        "id" varchar(100) PRIMARY KEY,
        "source" varchar(50) NOT NULL,
        "event_type" varchar(100) NOT NULL,
        "received_at" timestamptz NOT NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "processed_webhook_events"`);
    await queryRunner.query(`DROP TABLE "outbox_messages"`);
  }
}
