// Inbox of webhook events already accepted. Providers deliver at-least-once and retry on
// timeouts, so the same event id can arrive several times; only the first one is processed.
export interface ProcessedWebhookEvent {
  id: string;
  source: string;
  eventType: string;
  receivedAt: Date;
}

export interface ProcessedWebhookEventRepository {
  // Returns false (without raising a database error) when the event id was already recorded.
  recordIfNew(event: ProcessedWebhookEvent): Promise<boolean>;
}

export const PROCESSED_WEBHOOK_EVENT_REPOSITORY = Symbol('PROCESSED_WEBHOOK_EVENT_REPOSITORY');
