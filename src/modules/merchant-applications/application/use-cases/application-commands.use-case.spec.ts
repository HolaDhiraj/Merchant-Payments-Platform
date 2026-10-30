import { Role } from '../../../../shared/domain/role.enum';
import {
  AccessDeniedError,
  BusinessRuleViolationError,
  EntityNotFoundError,
} from '../../../../shared/domain/domain-errors';
import { AuditLogger } from '../../../audit/application/audit-logger';
import { AuditAction } from '../../../audit/domain/audit-action.enum';
import { User } from '../../../users/domain/user';
import { UserRepository } from '../../../users/domain/user.repository';
import {
  ImmediateUnitOfWork,
  InMemoryAuditLogRepository,
  InMemoryMerchantApplicationRepository,
  RecordingOutbox,
} from '../../../../../test/support/fakes/in-memory-repositories';
import { FixedClock, SequentialIdGenerator } from '../../../../../test/support/fakes/fixed-clock';
import {
  ADMIN_ID,
  detailsInput,
  OTHER_REVIEWER_ID,
  OTHER_SALES_ID,
  REVIEWER_ID,
  SALES_ID,
} from '../../../../../test/support/fakes/application-builders';
import { ApplicationStatus } from '../../domain/model/application-status.enum';
import { ReviewDecision } from '../../domain/model/review-decision.enum';
import { RiskLevel } from '../../domain/model/risk.enums';
import { MerchantApplicationReader } from '../services/merchant-application-reader';
import { RiskReviewScheduler } from '../services/risk-review-scheduler';
import { CreateMerchantApplicationUseCase } from './create-merchant-application.use-case';
import { UpdateMerchantApplicationUseCase } from './update-merchant-application.use-case';
import { SubmitMerchantApplicationUseCase } from './submit-merchant-application.use-case';
import { AssignReviewerUseCase } from './assign-reviewer.use-case';
import { RecordReviewDecisionUseCase } from './record-review-decision.use-case';
import { ListMerchantApplicationsUseCase } from './list-merchant-applications.use-case';

const sales = { userId: SALES_ID, role: Role.SALES };
const otherSales = { userId: OTHER_SALES_ID, role: Role.SALES };
const admin = { userId: ADMIN_ID, role: Role.ADMIN };
const reviewer = { userId: REVIEWER_ID, role: Role.REVIEWER };
const otherReviewer = { userId: OTHER_REVIEWER_ID, role: Role.REVIEWER };

function user(id: string, role: Role, isActive = true): User {
  const now = new Date();
  return User.restore({
    id,
    email: `${id}@example.test`,
    fullName: 'Test',
    role,
    passwordHash: 'x',
    isActive,
    merchantId: null,
    mustChangePassword: false,
    failedLoginAttempts: 0,
    lockedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

describe('Merchant application command use cases', () => {
  let applications: InMemoryMerchantApplicationRepository;
  let auditLog: InMemoryAuditLogRepository;
  let outbox: RecordingOutbox;
  let clock: FixedClock;
  let create: CreateMerchantApplicationUseCase;
  let update: UpdateMerchantApplicationUseCase;
  let submit: SubmitMerchantApplicationUseCase;
  let assign: AssignReviewerUseCase;
  let decide: RecordReviewDecisionUseCase;
  let list: ListMerchantApplicationsUseCase;
  let onboarding: { onboard: jest.Mock };
  const credentials = {
    merchantId: 'merchant-1',
    ownerUserId: 'owner-1',
    ownerEmail: 'owner@example.test',
    temporaryPassword: 'TempPassword42x',
  };

  beforeEach(() => {
    applications = new InMemoryMerchantApplicationRepository();
    auditLog = new InMemoryAuditLogRepository();
    clock = new FixedClock();
    const ids = new SequentialIdGenerator();
    const audit = new AuditLogger(auditLog, clock, ids);
    const unitOfWork = new ImmediateUnitOfWork();
    outbox = new RecordingOutbox(unitOfWork);
    const reader = new MerchantApplicationReader(applications);
    const users: UserRepository = {
      findById: async (id) =>
        ({
          [REVIEWER_ID]: user(REVIEWER_ID, Role.REVIEWER),
          [OTHER_REVIEWER_ID]: user(OTHER_REVIEWER_ID, Role.REVIEWER, false),
          [OTHER_SALES_ID]: user(OTHER_SALES_ID, Role.SALES),
        })[id] ?? null,
      findByEmail: async () => null,
      insert: async () => undefined,
      search: async () => ({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }),
      recordFailedLogin: async () => ({ failedLoginAttempts: 1, lockedAt: null }),
      clearLoginFailures: async () => undefined,
      updatePassword: async () => undefined,
      setActive: async () => undefined,
    };

    create = new CreateMerchantApplicationUseCase(applications, unitOfWork, clock, ids, audit);
    update = new UpdateMerchantApplicationUseCase(reader, applications, unitOfWork, clock, audit);
    submit = new SubmitMerchantApplicationUseCase(
      reader,
      applications,
      unitOfWork,
      clock,
      audit,
      new RiskReviewScheduler(outbox),
    );
    assign = new AssignReviewerUseCase(reader, applications, users, unitOfWork, clock, audit);
    onboarding = { onboard: jest.fn(async () => credentials) };
    decide = new RecordReviewDecisionUseCase(
      reader,
      applications,
      unitOfWork,
      clock,
      audit,
      onboarding,
    );
    list = new ListMerchantApplicationsUseCase(applications);
  });

  // Moves a freshly created application to UNDER_REVIEW with REVIEWER_ID assigned.
  async function prepareUnderReview(): Promise<string> {
    const application = await create.execute(sales, detailsInput());
    await submit.execute(sales, application.id);
    const loaded = await applications.findById(application.id);
    loaded!.completeRiskReview(
      { submissionNumber: 1, level: RiskLevel.LOW, score: 10 },
      clock.now(),
    );
    await applications.update(loaded!);
    await assign.execute(admin, application.id, REVIEWER_ID);
    return application.id;
  }

  it('creates a DRAFT owned by the caller and audits it', async () => {
    const application = await create.execute(sales, detailsInput());
    expect(application.createdById).toBe(SALES_ID);
    expect(application.status).toBe(ApplicationStatus.DRAFT);
    expect(auditLog.entries[0].action).toBe(AuditAction.APPLICATION_CREATED);
  });

  it("returns not-found when a sales user edits someone else's application", async () => {
    const application = await create.execute(sales, detailsInput());
    await expect(
      update.execute(otherSales, application.id, { businessName: 'Hijack' }),
    ).rejects.toBeInstanceOf(EntityNotFoundError);
    expect((await applications.findById(application.id))?.details.businessName).toBe('Test Coffee');
  });

  it('records only changed field names (not values) in the audit trail', async () => {
    const application = await create.execute(sales, detailsInput());
    await update.execute(sales, application.id, {
      taxId: '00-0009999',
      owner: { phone: '+15555550199' },
    });
    const metadata = auditLog.entries[1].metadata;
    expect(metadata).toEqual({ changedFields: ['taxId', 'owner.phone'] });
  });

  it('requests exactly one risk review through the outbox, with an idempotency key', async () => {
    const application = await create.execute(sales, detailsInput());
    await submit.execute(sales, application.id);
    expect(outbox.messages).toEqual([
      {
        topic: 'risk-review.requested',
        payload: {
          applicationId: application.id,
          submissionNumber: 1,
          idempotencyKey: `risk-review:${application.id}:1`,
          correlationId: null,
        },
        insideTransaction: true,
      },
    ]);
  });

  it('writes no outbox message when the submission is rejected', async () => {
    const application = await create.execute(sales, detailsInput());
    await submit.execute(sales, application.id);
    await expect(submit.execute(sales, application.id)).rejects.toThrow();
    expect(outbox.messages).toHaveLength(1);
  });

  it('only assigns active reviewers', async () => {
    const application = await create.execute(sales, detailsInput());
    await expect(assign.execute(admin, application.id, OTHER_SALES_ID)).rejects.toBeInstanceOf(
      BusinessRuleViolationError,
    );
    await expect(assign.execute(admin, application.id, OTHER_REVIEWER_ID)).rejects.toBeInstanceOf(
      BusinessRuleViolationError,
    );
    await expect(assign.execute(sales, application.id, REVIEWER_ID)).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
  });

  it('lets only the assigned reviewer decide', async () => {
    const id = await prepareUnderReview();
    await expect(
      decide.execute(otherReviewer, id, { decision: ReviewDecision.APPROVE }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(
      decide.execute(admin, id, { decision: ReviewDecision.APPROVE }),
    ).rejects.toBeInstanceOf(AccessDeniedError);

    const approved = await decide.execute(reviewer, id, { decision: ReviewDecision.APPROVE });
    expect(approved.application.status).toBe(ApplicationStatus.APPROVED);
    expect(auditLog.entries.at(-1)?.action).toBe(AuditAction.REVIEW_DECISION_RECORDED);
    // Approval onboards the merchant and hands back the owner's one-time sign-in.
    expect(onboarding.onboard).toHaveBeenCalledWith(
      reviewer,
      expect.objectContaining({ applicationId: id, owner: expect.any(Object) }),
    );
    expect(approved.onboarding).toEqual(credentials);
  });

  it('lists only the caller’s own applications for sales users', async () => {
    await create.execute(sales, detailsInput());
    await create.execute(otherSales, detailsInput({ businessName: 'Other Shop' }));
    const page = await list.execute(sales, { page: { page: 1, pageSize: 10 } });
    expect(page.items.map((application) => application.createdById)).toEqual([SALES_ID]);
    expect(page.totalItems).toBe(1);
  });
});
