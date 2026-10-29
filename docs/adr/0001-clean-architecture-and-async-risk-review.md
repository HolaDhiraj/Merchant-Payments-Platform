# ADR 0001: Use-case driven Clean Architecture and an idempotent asynchronous risk review

- Status: Accepted
- Date: 2026-10-29

## Context

The service onboards merchants, which is a regulated, security-sensitive workflow. Requirements: strict object-level
authorization, a lifecycle with no invalid transitions, a third-party risk check that is slow and unreliable,
an audit trail, and protection of sensitive fields. The time-box is 6-8 hours.

## Decision

1. **Feature modules with Clean Architecture layers** (domain, application, infrastructure, presentation).
   Business rules live in the `MerchantApplication` aggregate and `MerchantApplicationAccessPolicy`, which have
   no framework dependencies. Each user action is one use-case class. Infrastructure implements ports bound in
   the module file (dependency inversion).
2. **State machine as data** (`ApplicationLifecycle`) rather than scattered conditionals.
3. **Object-level authorization in the application layer**, returning 404 for objects the caller may not see,
   with the visibility scope pushed into SQL for lists.
4. **BullMQ for the risk review**, enqueued after commit, with exponential-backoff retries and a FAILED terminal
   risk state that an admin can re-queue.
5. **Layered idempotency**: a deterministic idempotency key per submission, used as the BullMQ job id, forwarded to
   the vendor and backed by a UNIQUE constraint; optimistic locking on the aggregate.
6. **UnitOfWork via AsyncLocalStorage**, so repositories join the transaction implicitly and business changes and
   audit entries commit atomically.
7. **Field-level encryption at the persistence boundary** (mapper) with AES-256-GCM for the tax id.

## Alternatives considered

- *Classic Nest service layer (fat services).* Faster to write, but mixes HTTP, ORM and rules, and is harder to unit test.
- *Transactional outbox.* Removes the commit-then-enqueue gap but needs a relay process. Deferred and documented.
- *Pessimistic row locks in the worker.* Simpler reasoning, but holds locks during a slow vendor call. Optimistic
  locking with retries fits better.
- *TypeORM `@VersionColumn` with `save()`.* It does not fail on a stale version for updates, so an explicit
  compare-and-swap `UPDATE ... WHERE version = :v` is used instead.

## Consequences

- More files and indirection than a minimal CRUD app, but each rule has one home and is unit-testable without infrastructure.
- The vendor, audit store or queue can be swapped by writing a new adapter.
- Operators must watch for applications in `riskStatus = FAILED` (or long `PENDING`) and use the retry endpoint.
