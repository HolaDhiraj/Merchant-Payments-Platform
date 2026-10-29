import { buildPage, Page, PageRequest } from '../../../src/shared/application/pagination';
import { UnitOfWork } from '../../../src/shared/application/unit-of-work';
import { Outbox, OutboxMessage } from '../../../src/shared/application/outbox';
import { ConcurrencyConflictError } from '../../../src/shared/domain/domain-errors';
import { MerchantApplication } from '../../../src/modules/merchant-applications/domain/model/merchant-application';
import { RiskAssessment } from '../../../src/modules/merchant-applications/domain/model/risk-assessment';
import {
  ApplicationSearchCriteria,
  MerchantApplicationRepository,
} from '../../../src/modules/merchant-applications/domain/ports/merchant-application.repository';
import { RiskAssessmentRepository } from '../../../src/modules/merchant-applications/domain/ports/risk-assessment.repository';
import {
  RiskReviewJob,
  RiskReviewQueue,
} from '../../../src/modules/merchant-applications/domain/ports/risk-review-queue';
import { AuditEntry } from '../../../src/modules/audit/domain/audit-entry';
import { AuditLogRepository } from '../../../src/modules/audit/domain/audit-log.repository';

// In-memory adapters used by unit tests. They honour the same contracts as the TypeORM
// adapters (optimistic locking, unique idempotency key) so business rules are tested realistically.

export class InMemoryMerchantApplicationRepository implements MerchantApplicationRepository {
  // Stored as snapshots (props) so each findById returns an independent aggregate instance,
  // just like loading from a database.
  private readonly rows = new Map<string, MerchantApplication>();

  async findById(id: string): Promise<MerchantApplication | null> {
    const stored = this.rows.get(id);
    return stored ? this.clone(stored) : null;
  }

  async insert(application: MerchantApplication): Promise<void> {
    this.rows.set(application.id, this.clone(application));
  }

  async update(application: MerchantApplication): Promise<void> {
    const stored = this.rows.get(application.id);
    if (!stored || stored.version !== application.version) {
      throw new ConcurrencyConflictError('MerchantApplication', application.id);
    }
    application.syncVersion(application.version + 1);
    this.rows.set(application.id, this.clone(application));
  }

  async search(
    criteria: ApplicationSearchCriteria,
    page: PageRequest,
  ): Promise<Page<MerchantApplication>> {
    const matches = [...this.rows.values()].filter(
      (app) =>
        (!criteria.scope.createdById || app.createdById === criteria.scope.createdById) &&
        (!criteria.scope.excludeStatuses || !criteria.scope.excludeStatuses.includes(app.status)) &&
        (!criteria.status || app.status === criteria.status) &&
        (!criteria.assignedReviewerId || app.assignedReviewerId === criteria.assignedReviewerId),
    );
    const start = (page.page - 1) * page.pageSize;
    return buildPage(
      matches.slice(start, start + page.pageSize).map((a) => this.clone(a)),
      matches.length,
      page,
    );
  }

  // Copies through public getters, so tests never share mutable state with the "database".
  private clone(app: MerchantApplication): MerchantApplication {
    return MerchantApplication.restore({
      id: app.id,
      createdById: app.createdById,
      details: {
        ...app.details,
        owner: { ...app.details.owner },
        processing: { ...app.details.processing },
      },
      status: app.status,
      riskStatus: app.riskStatus,
      riskLevel: app.riskLevel,
      riskScore: app.riskScore,
      assignedReviewerId: app.assignedReviewerId,
      submissionCount: app.submissionCount,
      decision: app.decision,
      decisionReason: app.decisionReason,
      decidedById: app.decidedById,
      submittedAt: app.submittedAt,
      decidedAt: app.decidedAt,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      version: app.version,
    });
  }
}

export class InMemoryRiskAssessmentRepository implements RiskAssessmentRepository {
  readonly rows: RiskAssessment[] = [];

  async findByIdempotencyKey(key: string): Promise<RiskAssessment | null> {
    return this.rows.find((row) => row.idempotencyKey === key) ?? null;
  }

  async findLatestByApplicationId(applicationId: string): Promise<RiskAssessment | null> {
    const rows = this.rows.filter((row) => row.applicationId === applicationId);
    return rows.sort((a, b) => b.submissionNumber - a.submissionNumber)[0] ?? null;
  }

  async insertIfAbsent(assessment: RiskAssessment): Promise<boolean> {
    if (this.rows.some((row) => row.idempotencyKey === assessment.idempotencyKey)) {
      return false;
    }
    this.rows.push(assessment);
    return true;
  }
}

export class InMemoryAuditLogRepository implements AuditLogRepository {
  readonly entries: AuditEntry[] = [];

  async append(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
  }

  async search(_filter: unknown, page: PageRequest): Promise<Page<AuditEntry>> {
    return buildPage(this.entries, this.entries.length, page);
  }
}

export class RecordingRiskReviewQueue implements RiskReviewQueue {
  readonly jobs: RiskReviewJob[] = [];

  async enqueue(job: RiskReviewJob): Promise<void> {
    this.jobs.push(job);
  }
}

// Records outbox messages and whether they were written inside a unit of work.
export class RecordingOutbox implements Outbox {
  readonly messages: Array<OutboxMessage & { insideTransaction: boolean }> = [];

  constructor(private readonly unitOfWork?: ImmediateUnitOfWork) {}

  async add(message: OutboxMessage): Promise<void> {
    this.messages.push({ ...message, insideTransaction: this.unitOfWork?.active ?? false });
  }
}

// Runs work directly; enough for unit tests where atomicity is not under test.
// Tracks whether a unit of work is active, so tests can assert that writes happen inside one.
export class ImmediateUnitOfWork implements UnitOfWork {
  active = false;

  async run<T>(work: () => Promise<T>): Promise<T> {
    const wasActive = this.active;
    this.active = true;
    try {
      return await work();
    } finally {
      this.active = wasActive;
    }
  }
}
