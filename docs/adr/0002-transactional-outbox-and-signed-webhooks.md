# ADR 0002: Transactional outbox for risk-review jobs and signed provider webhooks

- Status: Accepted (supersedes the "enqueue after commit" part of ADR 0001)
- Date: 2026-10-29

## Context

ADR 0001 enqueued the BullMQ job right after the database commit. If Redis was unavailable at that moment,
the application stayed `SUBMITTED / PENDING` with no job, and recovery depended on an operator noticing.
In payments operations a silently stuck onboarding is a real incident. Separately, KYB vendors usually deliver
results asynchronously through callbacks, and those callbacks must be authenticated and de-duplicated.

## Decision

1. **Transactional outbox.** Use cases write an `outbox_messages` row in the same transaction as the state change
   (`RiskReviewScheduler` → `Outbox` port). `OutboxRelay` polls with `FOR UPDATE SKIP LOCKED`, delivers each message
   through a topic handler (`RiskReviewOutboxHandler` → BullMQ), marks it dispatched, and on failure records the error
   and backs off (1 s doubling to 5 min). Delivery is at-least-once; the BullMQ job id (the idempotency key) makes it
   effectively once.
2. **Single result recorder.** `RiskAssessmentRecorder` is the only code path that applies a risk result. It is used by
   the worker and the webhook. It inserts with `ON CONFLICT DO NOTHING` (no aborted transactions) and updates the
   aggregate with optimistic locking.
3. **Signed webhook with an inbox.** `POST /webhooks/risk-provider` is authenticated by HMAC-SHA256 over
   `<event id>.<timestamp>.<raw body>`, with a timestamp tolerance window, constant-time comparison and support for
   several signatures during secret rotation. Accepted event ids go into `processed_webhook_events` in the same
   transaction that applies the result.
4. **Correlation id propagation.** The submitting request's correlation id is stored in the outbox payload and the
   job, and the worker re-establishes it, so audit entries across HTTP and background processing can be joined.

## Alternatives considered

- *Keep enqueue-after-commit plus a sweeper for stale PENDING rows.* Simpler, but recovery is periodic and heuristic.
- *Change data capture (Debezium / logical replication).* Lowest latency, but heavy infrastructure for this scope.
- *Webhook auth via mTLS or IP allow-listing only.* Complementary, but neither proves payload integrity on its own.

## Consequences

- A broker outage delays risk reviews but never loses them. The outbox backlog (`dispatched_at IS NULL`) becomes a
  monitoring signal.
- One extra table write per submission, plus a lightweight polling query.
- Dispatched outbox rows and old webhook inbox rows need a retention job.
