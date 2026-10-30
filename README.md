# Merchant Payments Platform

Merchant onboarding and risk-review platform built with **NestJS 11, TypeScript, PostgreSQL (TypeORM), Redis + BullMQ, JWT**,
plus a **React web client ("Merchant Desk")** served by the same NestJS process on the same port.
Sales users capture merchant applications, a background worker runs a (simulated) third-party KYB / risk check,
and the assigned reviewer approves, rejects or requests more information. Every significant action is audited.

Highlights: Clean Architecture with one class per use case · object-level authorization (BOLA-safe) · **transactional outbox**
→ BullMQ with retries, backoff and layered idempotency · **HMAC-signed provider webhook** with replay protection ·
AES-256-GCM field encryption · redacted, correlated audit trail · reviewed migrations · CI on GitHub Actions.

---

## 1. Quick start

Prerequisites: Node.js 20+, Docker with Compose.

```bash
npm install
npm run env:init                 # creates .env with freshly generated local secrets (never committed)
docker compose up -d postgres redis
set -a; . ./.env; set +a         # export .env for the TypeORM CLI and seed script
npm run migration:run            # applies the reviewed migrations (run again after pulling new ones)
npm run seed                     # creates one ADMIN, REVIEWER and SALES user from SEED_* variables in .env
npm run start:dev                # web app http://localhost:3000, API /api, Swagger UI /api/docs
```

Seed credentials are the `SEED_*_EMAIL` / `SEED_*_PASSWORD` values that `env:init` generated in your local `.env`.
Sign in to the web app with any of them; each role sees its own screens and actions.

### One port for the web app and the API

| URL | Served by |
|---|---|
| `http://localhost:3000/` (and every other non-`/api` path) | React web client |
| `http://localhost:3000/api/...` | REST API (all routes carry the `/api` prefix) |
| `http://localhost:3000/api/docs` | Swagger UI |

- **Development** (`npm run start:dev`): Nest mounts Vite in middleware mode on its own HTTP server
  (`src/infrastructure/web-client/web-client.ts`), so there is one process, one port, and hot reload for the client.
- **Production** (`npm run build` then `npm run start:prod`): `nest build` compiles the API, then Vite writes the
  client bundle to `dist/client`, which Nest serves as static files with an SPA fallback. Hashed assets are cached for a year.
- The client calls the API with relative `/api/...` URLs: same origin, so no CORS, no base-URL config, and the API stays
  fully usable from curl, Postman or Swagger on the same port.

The client lives in `client/` (React 19, React Router, TanStack Query, CSS Modules on design tokens, light and dark themes):

```
client/src/
  api/          typed fetch client, endpoint functions, React Query hooks (polls while a risk check runs)
  auth/         session storage, AuthProvider (GET /api/users/me), route guard
  components/   ui/ primitives (Button, Field, Dialog, Badge, Spinner, Skeleton…) and layout/ (AppShell, PageHeader)
  features/     applications, audit, team, auth: one folder per screen area
  lib/          formatting (money in minor units), enum labels, theme
  styles/       tokens.css (the whole palette and scale) and base.css
```

Run everything in containers (API applies migrations on start). Stop any local `start:dev` first, because both use port 3000:

```bash
npm run env:init                                   # only if .env does not exist yet
docker compose --profile app up --build
docker compose --profile app exec api npm run seed:prod   # create the SEED_* users inside the container
```

If `npm install` / `npm ci` hangs or crashes with `Exit handler never called!` on your network, it is Node's
IPv4/IPv6 auto-selection timing out. The Dockerfile already works around it; locally, run
`export NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection"` before installing.

Docker publishes PostgreSQL on host port **55432** and Redis on **56379**, so it does not clash with a locally installed Postgres or Redis.

### Tests

```bash
npm test                          # unit tests (no infrastructure needed)
npm run test:cov                  # unit tests with coverage
docker compose up -d postgres redis
set -a; . ./.env; set +a
npm run test:integration          # Supertest against real PostgreSQL + Redis + BullMQ worker
```

Integration tests use the separate `merchant_platform_test` database (created by `docker/postgres/init-test-db.sh`),
generate a random JWT secret and encryption key per run, and use a random BullMQ prefix.

---

## 2. Architecture

**Clean Architecture / use-case driven, organised per feature module.** Dependencies point inwards only:

```
presentation  ──►  application (use cases)  ──►  domain (aggregate, policies, ports)
      ▲                                             ▲
      └──────────── infrastructure (TypeORM, BullMQ, JWT, bcrypt, AES) implements ports
```

```
src/
├── config/                      env validation (Joi) + typed config groups
├── shared/                      shared kernel
│   ├── domain/                  Role, Actor, DomainError hierarchy, Clock, IdGenerator ports
│   ├── application/             UnitOfWork + Outbox ports, pagination types
│   ├── infrastructure/          TypeORM UnitOfWork (AsyncLocalStorage), transactional outbox + relay,
│   │                            request context
│   ├── security/                redaction/masking, AES-256-GCM field cipher
│   └── presentation/            guards, decorators, global exception filter, logging, correlation id
├── modules/
│   ├── auth/                    login use case, JWT token service, global JwtAuthGuard
│   ├── users/                   user aggregate, repository, bcrypt hasher, admin user creation
│   ├── audit/                   append-only audit trail (+ admin read endpoint)
│   ├── merchant-applications/
│   │   ├── domain/              MerchantApplication aggregate, lifecycle state machine,
│   │   │                        access policy, TaxId value object, ports
│   │   ├── application/         one class per use case + reader/scheduler services
│   │   ├── infrastructure/      ORM entities, mapper, repositories, BullMQ queue + worker,
│   │   │                        outbox handler, simulated KYB provider, webhook signature verifier
│   │   └── presentation/        controller, signed webhook controller + guard, validated DTOs
│   └── health/                  readiness probe (DB + Redis)
└── infrastructure/database/     TypeORM options, CLI data source, migrations, seed
```

### How SOLID shows up

| Principle | Where |
|---|---|
| **S**ingle responsibility | One use case class per action (`SubmitMerchantApplicationUseCase`, `RecordReviewDecisionUseCase`, ...). Controllers only map HTTP ⇄ use case. |
| **O**pen/closed | The lifecycle is a transition table (`application-lifecycle.ts`); new statuses or decisions extend data, not `if` chains. New risk vendors are new `RiskProvider` adapters. |
| **L**iskov substitution | In-memory repositories and the controllable risk provider honour the same contracts (optimistic locking, unique idempotency key) as the real adapters, so use cases behave the same in unit tests. |
| **I**nterface segregation | Small ports: `RiskReviewQueue`, `RiskProvider`, `FieldCipher`, `TokenService`, `PasswordHasher`, `UnitOfWork`, `Clock`. |
| **D**ependency inversion | Use cases depend on symbols/interfaces (`MERCHANT_APPLICATION_REPOSITORY`, `RISK_PROVIDER`, ...). Module files are the composition roots that bind ports to adapters. |

---

## 3. Domain model and business rules

### Application lifecycle

```
DRAFT ──submit──► SUBMITTED ──risk review done (worker)──► UNDER_REVIEW ──approve──► APPROVED
                     ▲                                          │ └──────reject───► REJECTED
                     └───────────── resubmit ── INFO_REQUESTED ◄┘ request info
```

| Rule | Enforced in |
|---|---|
| Edits only in `DRAFT` or `INFO_REQUESTED` | `MerchantApplication.updateDetails` |
| Any transition not in the table is rejected (409) | `ApplicationLifecycle.assertTransition` |
| A decision requires a completed risk review | `MerchantApplication.recordDecision` |
| `REJECT` and `REQUEST_INFO` require a reason | aggregate |
| Approving a **HIGH** risk merchant requires a justification | aggregate |
| Re-submission starts a fresh risk review (`submissionCount` + 1) and clears the previous decision | `MerchantApplication.submit` |
| No re-assignment or decision after `APPROVED` / `REJECTED` | aggregate |
| Average ticket ≤ monthly volume, amounts positive integers in minor units, MCC 4 digits, ISO 4217 currency | `assertValidBusinessDetails` + DB CHECK constraints |

Risk status is tracked separately from the business status: `NOT_STARTED → PENDING → COMPLETED | FAILED`, plus `riskLevel` (LOW/MEDIUM/HIGH) and `riskScore` (0-100).

### Roles and object-level authorization

| Capability | ADMIN | REVIEWER | SALES |
|---|---|---|---|
| Create application | ✔ | ✘ | ✔ |
| View / list | all | all except `DRAFT` | **only own** |
| Edit / submit | all | ✘ | **only own** |
| Assign reviewer | ✔ | ✘ | ✘ |
| Record decision | ✘ (segregation of duties) | **only if assigned** | ✘ |
| Retry failed risk review, read audit log, create users | ✔ | ✘ | ✘ |

Two layers:

1. `@Roles(...)` + global `RolesGuard`: coarse, per endpoint (403).
2. `MerchantApplicationAccessPolicy`: per object, checked inside use cases. A SALES user accessing another user's application gets **404**, not 403, so ids cannot be probed (OWASP API1 / BOLA). List queries push the visibility scope into SQL, so rows outside the scope are never loaded.

Also: the JWT guard re-loads the user on every request, so deactivation and role changes take effect immediately, and the role comes from the DB rather than from the token alone. `ValidationPipe({ whitelist, forbidNonWhitelisted })` blocks mass assignment (e.g. sending `status: "APPROVED"` returns 400).

---

## 4. Asynchronous risk review: reliability and idempotency

```
HTTP submit ──► [ one DB transaction: application SUBMITTED + audit entry + outbox_messages row ] ──► 202
                                                         │
                     OutboxRelay (polls, FOR UPDATE SKIP LOCKED, backoff on failure)
                                                         ▼
                     BullMQ "risk-review" (jobId = idempotency key, 5 attempts, exponential backoff)
                                                         ▼
                     RiskReviewProcessor ──► ProcessRiskReviewUseCase ──► RiskProvider (vendor)
                                                         ▼
                     RiskAssessmentRecorder: [ one DB transaction: assessment + UNDER_REVIEW + audit ]
                                                         ▲
     Signed vendor webhook ──► HandleRiskProviderWebhookUseCase (inbox de-dup) ──┘
```

1. **Transactional outbox.** `POST /merchant-applications/:id/submit` writes the state change, the audit entry and an
   `outbox_messages` row in **one transaction**. `OutboxRelay` publishes committed rows to BullMQ. A Redis outage therefore
   only *delays* the review; it can never lose a request or publish one for a rolled-back change. The relay uses
   `FOR UPDATE SKIP LOCKED` (safe with many API instances), retries failed deliveries with backoff (1 s … 5 min) and never
   drops a message. `TypeOrmOutbox` refuses to write outside a transaction, so the guarantee cannot be bypassed by mistake.
2. **Small payloads.** Job payloads hold **identifiers only** (`applicationId`, `submissionNumber`, `idempotencyKey`,
   `correlationId`), so no merchant PII sits in Redis.
3. **Layered idempotency** (`ProcessRiskReviewUseCase` + `RiskAssessmentRecorder`):
   - The deterministic **job id** (from the idempotency key) collapses duplicate publishes.
   - A job is **skipped** if the application no longer awaits that exact submission (stale or duplicate delivery), or if an
     assessment already exists for the key. Both happen *before* calling the (paid, slow) vendor.
   - The idempotency key is **forwarded to the vendor** so it can de-duplicate on its side.
   - The assessment is inserted with `ON CONFLICT DO NOTHING` on a **UNIQUE** key, and the application is updated with
     **optimistic locking** (`version` compare-and-swap). Concurrent workers, or a worker racing the webhook, apply at most one result.
4. **Retries:** BullMQ `attempts = RISK_REVIEW_MAX_ATTEMPTS` (default 5) with **exponential backoff**. A
   `PermanentRiskProviderError` becomes `UnrecoverableError` and stops retrying immediately.
5. **Exhaustion:** the `failed` handler sets `riskStatus = FAILED` and audits it. The application stays `SUBMITTED`
   (it can never be approved without a result), and an admin re-queues it with `POST /merchant-applications/:id/risk-review/retry`.
6. **Traceability:** the submitting request's **correlation id** travels through the outbox and job, so worker audit
   entries share the correlation id of the HTTP request that caused them.

### Signed provider webhook (optional requirement, implemented)

`POST /webhooks/risk-provider` lets the vendor push results asynchronously instead of being polled.

| Concern | Implementation |
|---|---|
| Authentication | No JWT (machine caller). `x-webhook-signature: v1=hex(HMAC-SHA256(secret, "<id>.<timestamp>.<raw body>"))` |
| Integrity | Signature over the **raw request bytes** (`rawBody: true`), so any change to the body fails |
| Replay protection | `x-webhook-timestamp` must be within `RISK_WEBHOOK_TOLERANCE_SECONDS` (default 300 s), and the event id is inside the signed content |
| Timing attacks | Constant-time comparison (`timingSafeEqual`) |
| Secret rotation | Several comma-separated `v1=` signatures are accepted |
| Idempotency | `processed_webhook_events` inbox (event id is the primary key, `ON CONFLICT DO NOTHING`) in the **same transaction** as applying the result, plus the shared assessment idempotency key |
| Retry semantics | 2xx for applied / duplicate / stale / unknown-application (stop retrying); 5xx only when processing failed, so the provider retries and the event is not marked processed |

Example (bash):

```bash
BODY='{"eventType":"risk_assessment.completed","applicationId":"<uuid>","submissionNumber":1,"provider":"acme-kyb","providerReference":"ref-1","score":55,"level":"MEDIUM","reasons":["HIGH_AVERAGE_TICKET"],"assessedAt":"2026-10-29T15:00:00Z"}'
TS=$(date +%s); ID=evt_$(date +%s%N)
SIG=v1=$(printf '%s' "$ID.$TS.$BODY" | openssl dgst -sha256 -hmac "$RISK_WEBHOOK_SECRET" -hex | awk '{print $NF}')
curl -X POST localhost:3000/api/webhooks/risk-provider -H 'content-type: application/json' \
  -H "x-webhook-id: $ID" -H "x-webhook-timestamp: $TS" -H "x-webhook-signature: $SIG" -d "$BODY"
```

The vendor itself is simulated by `SimulatedKybRiskProvider`. It scores deterministically (high-risk MCC, volume, ticket
size, card-not-present, sole proprietorship), and its latency and transient failure rate are configurable (`RISK_PROVIDER_*`).

---

## 5. Audit trail and sensitive data

**Audited actions:** `USER_CREATED`, `LOGIN_SUCCEEDED`, `LOGIN_FAILED`, `APPLICATION_CREATED`, `APPLICATION_UPDATED` (field names only, never values), `APPLICATION_SUBMITTED`, `REVIEWER_ASSIGNED`, `RISK_REVIEW_COMPLETED`, `RISK_REVIEW_FAILED`, `RISK_REVIEW_RETRIED`, `REVIEW_DECISION_RECORDED`.
Each entry stores actor id and role (or `SYSTEM` for the worker), entity, redacted metadata, the request **correlation id** and a timestamp. Audit writes share the business transaction, so an action and its audit record commit or roll back together. Admins read them at `GET /audit-logs`.

**Never logged:** passwords, password hashes, tokens, `Authorization` headers, secrets.

- `AuditLogger` always passes metadata through `redactSensitive()`: secrets become `[REDACTED]`, and email, phone and tax id are masked.
- The HTTP access log records only method, route, status, duration and correlation id. It never records bodies, headers or query strings.
- The exception filter returns generic 500s and never echoes payloads.
- `User.toJSON()` drops the password hash, and `TaxId.toString()` / `toJSON()` return the masked value, so accidental serialisation is safe.

### Field-level encryption

| Field | Classification | Treatment in this submission | Production recommendation |
|---|---|---|---|
| `taxId` (EIN / TIN) | Highly sensitive, regulated | **Implemented:** AES-256-GCM (random IV, auth tag, versioned format `v1.`), only `tax_id_last4` stored in clear. API returns `taxIdMasked` only. | Envelope encryption with a KMS-managed data key; key rotation using the version prefix |
| Owner date of birth, national id / SSN, bank account and routing numbers | Highly sensitive | **Not collected** (data minimisation) | Must be field-encrypted if added; bank data ideally tokenised by the processor |
| Owner email, owner phone, owner name | PII | Stored in clear for search and contact; masked in logs and audit | Consider encryption plus a blind index if search is needed; retention policy |
| Card data (PAN, CVV) | PCI DSS | **Never handled** by this service | Keep out of scope via processor tokenisation |
| Password | Secret | bcrypt (cost 12), never logged | Same, plus breached-password checks |

**Secrets:** no secret is committed. `.env` is git-ignored, `.env.example` holds only `CHANGE_ME` placeholders (rejected by Joi validation at boot), `npm run env:init` generates local secrets, and tests generate their own per run. Test data is synthetic (`example.test` domains, fake tax ids).

Other hardening: `helmet`, login rate limiting (`@nestjs/throttler`, default 5 per minute per IP), timing-safe login (a hash comparison always runs, with one generic error), JWT with issuer and audience checks, HS256 pinned, 15-minute expiry.

---

## 6. Data model (PostgreSQL)

Defined in **hand-written, reviewed** migrations (`src/infrastructure/database/migrations/`); `synchronize` is always off.

- `users`: unique lowercase email (CHECK), role enum.
- `merchant_applications`: native enums for every status; money as `BIGINT` minor units with CHECK > 0; MCC and currency regex CHECKs; risk score 0-100; `APPROVED`/`REJECTED` rows must have a decision and decider (CHECK); `version` column for optimistic locking. Indexes match the access paths: `(created_by_id, created_at)` for the SALES list, `(status, created_at)` for the status filter, `(assigned_reviewer_id, status)` for reviewer queues.
- `risk_assessments`: `UNIQUE (idempotency_key)`, reasons as `jsonb`.
- `audit_logs`: append-only, no FKs on purpose (the trail outlives entities), `jsonb` metadata, index on `(entity_type, entity_id, occurred_at)`.
- `outbox_messages`: transactional outbox with attempts, last error and `available_at` backoff; a partial index covers only undelivered rows.
- `processed_webhook_events`: webhook inbox; the provider event id is the primary key.
- FKs use `ON DELETE RESTRICT`.

---

## 7. API overview

Full, interactive documentation: **`/api/docs`** (Swagger / OpenAPI). Every path below is relative to **`/api`**.

| Method | Path | Roles |
|---|---|---|
| POST | `/auth/login` | public (rate limited) |
| POST | `/users` | ADMIN |
| GET | `/users?role=&page=&pageSize=` | ADMIN |
| GET | `/users/me` | any signed-in user |
| POST | `/merchant-applications` | SALES, ADMIN |
| GET | `/merchant-applications?status=&page=&pageSize=&assignedToMe=` | all (scoped) |
| GET | `/merchant-applications/:id` | all (scoped) |
| PATCH | `/merchant-applications/:id` | SALES (own), ADMIN |
| POST | `/merchant-applications/:id/submit` | SALES (own), ADMIN |
| PUT | `/merchant-applications/:id/reviewer` | ADMIN |
| POST | `/merchant-applications/:id/decision` | assigned REVIEWER |
| POST | `/merchant-applications/:id/risk-review/retry` | ADMIN |
| GET | `/merchant-applications/:id/risk-assessment` | all (scoped) |
| GET | `/audit-logs?entityId=&action=` | ADMIN |
| POST | `/webhooks/risk-provider` | public, **HMAC signature required** |
| GET | `/health` | public |

Errors share one shape: `{ statusCode, error, message, path, correlationId, timestamp }`. Status mapping: 400 validation, 401 authentication, 403 role or assignment, 404 missing or not visible, 409 invalid transition or concurrent update, 422 business rule.

---

## 8. Testing

| Suite | What it proves |
|---|---|
| Unit: `merchant-application.spec.ts`, `application-lifecycle.spec.ts` | Every allowed transition plus **every forbidden pair**, reasons, HIGH-risk justification, the request-info loop, stale or duplicate risk results ignored |
| Unit: `merchant-application-access.policy.spec.ts` | SALES isolation, reviewer assignment rule, admin cannot decide |
| Unit: `process-risk-review.use-case.spec.ts` | Idempotency (duplicate delivery, concurrent workers, stored-assessment reuse, stale submission), transient error propagation, failure marking once |
| Unit: `application-commands.use-case.spec.ts`, `login.use-case.spec.ts` | Use-case orchestration, audit content, enqueue-after-commit and queue outage, generic login errors, timing-safe path |
| Unit: `redaction`, `aes-gcm-field-cipher`, `tax-id`, `simulated-kyb-risk.provider` | Masking, tamper detection, wrong key, deterministic scoring |
| Integration: `auth.e2e-spec.ts` | Login, generic 401s, forged token, deactivated user, no secrets in audit |
| Integration: `authorization.e2e-spec.ts` | **SALES cannot read, edit, submit or list another user's application by id**; role 403s; mass assignment; only the assigned reviewer (not another reviewer, not an admin) can decide |
| Integration: `lifecycle.e2e-spec.ts` | Full journey including request-info and resubmission, invalid transitions (409), validation (400/422), pagination and filter, encryption at rest, audit coverage |
| Integration: `risk-processing.e2e-spec.ts` | Real BullMQ worker: retry with backoff, exhaustion to FAILED, admin retry, permanent error stops retries, duplicate enqueue gives one result, concurrent workers give one result, correlation id propagated to worker audit, PII-free payloads |
| Integration: `outbox.e2e-spec.ts` | Outbox row written with the submission and dispatched; nothing written on rollback; **broker outage keeps the request, recovery delivers it** |
| Integration: `webhook.e2e-spec.ts` | Signed result applied, redelivery de-duplicated, second result for the same submission ignored, bad signature / tampered body / stale timestamp / missing headers give 401, payload validation, unknown application acknowledged |
| Unit: `hmac-webhook-signature.verifier.spec.ts`, `handle-risk-provider-webhook.use-case.spec.ts` | Signature edge cases (rotation, replay under a new id, truncation), webhook idempotency |

Current result: **123 unit tests, 50 integration tests, all passing** (integration suite run three times in a row to check for flakiness).
CI (`.github/workflows/ci.yml`) runs lint, typecheck, build, unit tests with coverage and the integration suite against
PostgreSQL and Redis service containers on every push and PR. Set `TEST_LOGS=1` to see application logs while debugging tests.

---

## 9. Trade-offs and next steps

- **Outbox relay polls** (default every 500 ms) rather than using logical replication or LISTEN/NOTIFY. That adds sub-second
  latency, which is negligible next to a KYB call, and keeps the design simple. Dispatched rows should be purged by a retention job.
- **Worker and relay run in the API process** for simplicity. In production they would run as separate deployments from the
  same image (both are already safe to scale horizontally: SKIP LOCKED, deterministic job ids, optimistic locking).
- **Audit log in PostgreSQL** (explicitly allowed). The repository port makes a MongoDB adapter a drop-in. In production,
  deny UPDATE/DELETE on `audit_logs` to the app's DB role.
- **Stateless JWT access tokens only**, with no refresh tokens or revocation list. Re-loading the user per request covers deactivation.
- **Login throttling is in-memory per instance.** Multi-instance deployments should use the Redis throttler storage.
- **Simulated KYB vendor.** A real adapter would add HTTP timeouts, a circuit breaker and map 4xx/5xx to permanent/transient errors.
- **Skipped optional item:** MongoDB audit storage (the port supports it). ADRs are in `docs/adr/`.

---

## 10. AI assistance disclosure

An AI coding assistant was used to scaffold and write parts of the code, tests and documentation.
Verification steps: I reviewed every file, ran type-check (`tsc`, app and tests), ESLint, the unit suite and the integration suite
against real PostgreSQL and Redis, and did a manual smoke test of the full lifecycle over HTTP (create, submit, async risk review,
assign, approve, audit log), checking that the tax id is stored only as ciphertext.
