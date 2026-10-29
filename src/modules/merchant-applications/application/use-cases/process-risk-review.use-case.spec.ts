import { AuditLogger } from '../../../audit/application/audit-logger';
import { AuditAction } from '../../../audit/domain/audit-action.enum';
import {
  ImmediateUnitOfWork,
  InMemoryAuditLogRepository,
  InMemoryMerchantApplicationRepository,
  InMemoryRiskAssessmentRepository,
} from '../../../../../test/support/fakes/in-memory-repositories';
import { FixedClock, SequentialIdGenerator } from '../../../../../test/support/fakes/fixed-clock';
import { ControllableRiskProvider } from '../../../../../test/support/fakes/controllable-risk-provider';
import { draftApplication } from '../../../../../test/support/fakes/application-builders';
import { ApplicationStatus } from '../../domain/model/application-status.enum';
import { MerchantApplication } from '../../domain/model/merchant-application';
import { RiskLevel, RiskStatus } from '../../domain/model/risk.enums';
import { TransientRiskProviderError } from '../../domain/ports/risk-provider';
import { RiskReviewJob } from '../../domain/ports/risk-review-queue';
import { ProcessRiskReviewUseCase, RiskReviewOutcome } from './process-risk-review.use-case';
import { MarkRiskReviewFailedUseCase } from './mark-risk-review-failed.use-case';
import { RiskAssessmentRecorder } from '../services/risk-assessment-recorder';

describe('ProcessRiskReviewUseCase', () => {
  let applications: InMemoryMerchantApplicationRepository;
  let assessments: InMemoryRiskAssessmentRepository;
  let auditLog: InMemoryAuditLogRepository;
  let provider: ControllableRiskProvider;
  let useCase: ProcessRiskReviewUseCase;
  let markFailed: MarkRiskReviewFailedUseCase;
  let job: RiskReviewJob;

  beforeEach(async () => {
    applications = new InMemoryMerchantApplicationRepository();
    assessments = new InMemoryRiskAssessmentRepository();
    auditLog = new InMemoryAuditLogRepository();
    provider = new ControllableRiskProvider();
    const clock = new FixedClock();
    const ids = new SequentialIdGenerator();
    const audit = new AuditLogger(auditLog, clock, ids);
    const unitOfWork = new ImmediateUnitOfWork();

    const recorder = new RiskAssessmentRecorder(
      applications,
      assessments,
      unitOfWork,
      clock,
      audit,
    );
    useCase = new ProcessRiskReviewUseCase(
      applications,
      assessments,
      provider,
      clock,
      ids,
      recorder,
    );
    markFailed = new MarkRiskReviewFailedUseCase(applications, unitOfWork, clock, audit);

    const application = draftApplication();
    const submissionNumber = application.submit(clock.now());
    await applications.insert(application);
    job = {
      applicationId: application.id,
      submissionNumber,
      idempotencyKey: MerchantApplication.riskReviewIdempotencyKey(
        application.id,
        submissionNumber,
      ),
    };
  });

  it('stores the assessment, moves the application to UNDER_REVIEW and audits it', async () => {
    await expect(useCase.execute(job)).resolves.toBe(RiskReviewOutcome.COMPLETED);

    const application = await applications.findById(job.applicationId);
    expect(application?.status).toBe(ApplicationStatus.UNDER_REVIEW);
    expect(application?.riskStatus).toBe(RiskStatus.COMPLETED);
    expect(assessments.rows).toHaveLength(1);
    expect(auditLog.entries.map((entry) => entry.action)).toEqual([
      AuditAction.RISK_REVIEW_COMPLETED,
    ]);
    expect(provider.calls[0].idempotencyKey).toBe(job.idempotencyKey);
  });

  it('is idempotent: a duplicate delivery does not call the provider or store a second result', async () => {
    await useCase.execute(job);
    await expect(useCase.execute(job)).resolves.toBe(RiskReviewOutcome.SKIPPED_ALREADY_PROCESSED);

    expect(provider.calls).toHaveLength(1);
    expect(assessments.rows).toHaveLength(1);
    expect(auditLog.entries).toHaveLength(1);
  });

  it('handles two workers racing on the same job: only one result is applied', async () => {
    const outcomes = await Promise.all([useCase.execute(job), useCase.execute(job)]);

    expect(outcomes.filter((outcome) => outcome === RiskReviewOutcome.COMPLETED)).toHaveLength(1);
    expect(assessments.rows).toHaveLength(1);
  });

  it('skips without calling the provider when an assessment for the key already exists', async () => {
    await assessments.insertIfAbsent({
      id: 'stored',
      applicationId: job.applicationId,
      submissionNumber: job.submissionNumber,
      idempotencyKey: job.idempotencyKey,
      provider: 'simulated-kyb',
      providerReference: 'ref',
      score: 42,
      level: RiskLevel.MEDIUM,
      reasons: [],
      assessedAt: new Date(),
    });

    await expect(useCase.execute(job)).resolves.toBe(RiskReviewOutcome.SKIPPED_ALREADY_PROCESSED);
    expect(provider.calls).toHaveLength(0);
  });

  it('skips jobs for a stale submission', async () => {
    const outcome = await useCase.execute({ ...job, submissionNumber: job.submissionNumber + 1 });
    expect(outcome).toBe(RiskReviewOutcome.SKIPPED_ALREADY_PROCESSED);
    expect(provider.calls).toHaveLength(0);
  });

  it('skips jobs for unknown applications', async () => {
    const outcome = await useCase.execute({
      ...job,
      applicationId: '00000000-0000-4000-8000-999999999999',
    });
    expect(outcome).toBe(RiskReviewOutcome.SKIPPED_NOT_FOUND);
  });

  it('propagates transient provider errors so the queue retries, leaving state untouched', async () => {
    provider.transientFailuresRemaining = 1;
    await expect(useCase.execute(job)).rejects.toBeInstanceOf(TransientRiskProviderError);

    const application = await applications.findById(job.applicationId);
    expect(application?.riskStatus).toBe(RiskStatus.PENDING);
    expect(assessments.rows).toHaveLength(0);

    // The retry succeeds.
    await expect(useCase.execute(job)).resolves.toBe(RiskReviewOutcome.COMPLETED);
  });

  it('marks the review FAILED after retries are exhausted, once', async () => {
    await expect(markFailed.execute(job, 'TransientRiskProviderError: down', 5)).resolves.toBe(
      true,
    );
    await expect(markFailed.execute(job, 'TransientRiskProviderError: down', 5)).resolves.toBe(
      false,
    );

    const application = await applications.findById(job.applicationId);
    expect(application?.riskStatus).toBe(RiskStatus.FAILED);
    expect(auditLog.entries.map((entry) => entry.action)).toEqual([AuditAction.RISK_REVIEW_FAILED]);
  });
});
