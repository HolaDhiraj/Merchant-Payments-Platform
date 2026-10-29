import { Injectable } from '@nestjs/common';
import { OutboxMessageHandler } from '../../application/outbox';

// Maps a topic to the handler that delivers it. Feature modules register their own handlers,
// so the shared relay never depends on feature code (dependency inversion).
@Injectable()
export class OutboxHandlerRegistry {
  private readonly handlers = new Map<string, OutboxMessageHandler>();

  register(handler: OutboxMessageHandler): void {
    if (this.handlers.has(handler.topic)) {
      throw new Error(`Outbox handler for topic "${handler.topic}" is already registered`);
    }
    this.handlers.set(handler.topic, handler);
  }

  // Replaces a handler; used by tests to simulate delivery failures.
  replace(handler: OutboxMessageHandler): void {
    this.handlers.set(handler.topic, handler);
  }

  find(topic: string): OutboxMessageHandler | undefined {
    return this.handlers.get(topic);
  }
}
