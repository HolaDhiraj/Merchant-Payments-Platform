// Transactional outbox port. A message added here is stored in the SAME database transaction
// as the business change, so "state changed" and "event will be published" can never disagree:
// either both commit or neither does. A relay publishes stored messages afterwards.
export interface OutboxMessage {
  topic: string;
  payload: Record<string, unknown>;
}

export interface Outbox {
  add(message: OutboxMessage): Promise<void>;
}

export const OUTBOX = Symbol('OUTBOX');

// Delivers one kind of outbox message (by topic) to its real destination, e.g. a BullMQ queue.
// Handlers must be idempotent: a message can be delivered more than once if the relay crashes
// between delivery and marking it as dispatched.
export interface OutboxMessageHandler {
  readonly topic: string;
  handle(payload: Record<string, unknown>): Promise<void>;
}
