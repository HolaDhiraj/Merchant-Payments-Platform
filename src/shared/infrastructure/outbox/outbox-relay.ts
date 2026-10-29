import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { outboxConfig, OutboxConfig } from '../../../config/app.config';
import { OutboxHandlerRegistry } from './outbox-handler.registry';

interface PendingMessage {
  id: string;
  topic: string;
  payload: Record<string, unknown>;
  attempts: number;
}

// Backoff for failed deliveries: 1s, 2s, 4s ... capped at 5 minutes. Messages are never dropped.
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;

// Polls the outbox table and hands committed messages to their topic handler.
//
// - "FOR UPDATE SKIP LOCKED" lets several API instances run the relay concurrently without
//   delivering the same message twice at the same time.
// - Delivery is at-least-once; handlers (e.g. BullMQ with a deterministic job id) are idempotent.
// - A failing message is retried later with backoff and does not block the rest of the batch.
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;
  private inFlight?: Promise<number>;
  private stopped = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly registry: OutboxHandlerRegistry,
    @Inject(outboxConfig.KEY) private readonly config: OutboxConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.relayEnabled) {
      this.scheduleNextRun(0);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.inFlight;
  }

  // Dispatches one batch and returns how many messages were delivered. Public for tests and tooling.
  async dispatchBatch(): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const messages: PendingMessage[] = await manager.query(
        `SELECT id, topic, payload, attempts
           FROM outbox_messages
          WHERE dispatched_at IS NULL AND available_at <= now()
          ORDER BY created_at
          LIMIT $1
          FOR UPDATE SKIP LOCKED`,
        [this.config.batchSize],
      );

      let delivered = 0;
      for (const message of messages) {
        if (await this.deliver(manager, message)) {
          delivered += 1;
        }
      }
      return delivered;
    });
  }

  private async deliver(manager: EntityManager, message: PendingMessage): Promise<boolean> {
    try {
      const handler = this.registry.find(message.topic);
      if (!handler) {
        throw new Error(`No outbox handler registered for topic "${message.topic}"`);
      }
      await handler.handle(message.payload);
      await manager.query('UPDATE outbox_messages SET dispatched_at = now() WHERE id = $1', [
        message.id,
      ]);
      return true;
    } catch (error) {
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      const delayMs = Math.min(BASE_RETRY_DELAY_MS * 2 ** message.attempts, MAX_RETRY_DELAY_MS);
      await manager.query(
        `UPDATE outbox_messages
            SET attempts = attempts + 1,
                last_error = $2,
                available_at = now() + ($3 || ' milliseconds')::interval
          WHERE id = $1`,
        [message.id, reason.slice(0, 500), String(delayMs)],
      );
      this.logger.warn(`Outbox message ${message.id} (${message.topic}) failed: ${reason}`);
      return false;
    }
  }

  // setTimeout chain instead of setInterval, so a slow batch never overlaps the next one.
  private scheduleNextRun(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(async () => {
      this.inFlight = this.dispatchBatch().catch((error) => {
        this.logger.error(
          'Outbox relay run failed',
          error instanceof Error ? error.stack : undefined,
        );
        return 0;
      });
      const delivered = await this.inFlight;
      // A full batch suggests a backlog, so continue immediately.
      this.scheduleNextRun(delivered >= this.config.batchSize ? 0 : this.config.pollIntervalMs);
    }, delayMs);
  }
}
