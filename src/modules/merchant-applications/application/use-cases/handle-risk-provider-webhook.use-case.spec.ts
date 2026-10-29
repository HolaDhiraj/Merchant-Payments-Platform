import { AuditLogger } from '../../../audit/application/audit-logger';
import {
  ImmediateUnitOfWork,
  InMemoryAuditLogRepository,
  InMemoryMerchantApplicationRepository,
  InMemoryRiskAssessmentRepository,
} from '../../../../../test/support/fakes/in-memory-repositories';
import { FixedClock, SequentialIdGenerator } from '../../../../../test/support/fakes/fixed-clock';
import { draftApplication } from '../../../../../test/support/fakes/application-builders';
import { ApplicationStatus } from '../../domain/model/application-status.enum';
import { RiskLevel } from '../../domain/model/risk.enums';
import { ProcessedWebhookEventRepository } from '../../domain/ports/processed-webhook-event.repository';
import { RiskAssessmentRecorder, RiskResultOutcome } from '../services/risk-assessment-recorder';
import {
  HandleRiskProviderWebhookUseCase,
  RISK_ASSESSMENT_COMPLETED_EVENT,
  RiskProviderWebhookEvent,
} from './handle-risk-provider-webhook.use-case';

class InMemoryProcessedEvents implements ProcessedWebhookEventRepository {
  readonly ids = new Set<string>();

  async recordIfNew(event: { id: string }): Promise<boolean> {
    if (this.ids.has(event.id)) return false;
    this.ids.add(event.id);
    return true;
  }
}

describe('HandleRiskProviderWebhookUseCase', () => {
  let applications: InMemoryMerchantApplicationRepository;
  let assessments: InMemoryRiskAssessmentRepository;
  let useCase: HandleRiskProviderWebhookUseCase;
  let event: RiskProviderWebhookEvent;

  beforeEach(async () => {
    applications = new InMemoryMerchantApplicationRepository();
    assessments = new InMemoryRiskAssessmentRepository();
    const clock = new FixedClock();
    const ids = new SequentialIdGenerator();
    const unitOfWork = new ImmediateUnitOfWork();
    const audit = new AuditLogger(new InMemoryAuditLogRepository(), clock, ids);
    const recorder = new RiskAssessmentRecorder(
      applications,
      assessments,
      unitOfWork,
      clock,
      audit,
    );
    useCase = new HandleRiskProviderWebhookUseCase(
      new InMemoryProcessedEvents(),
      unitOfWork,
      clock,
      ids,
      recorder,
    );

    const application = draftApplication();
    const submissionNumber = application.submit(clock.now());
    await applications.insert(application);
    event = {
      eventId: 'evt_0000000001',
      eventType: RISK_ASSESSMENT_COMPLETED_EVENT,
      applicationId: application.id,
      submissionNumber,
      provider: 'acme-kyb',
      providerReference: 'ref-1',
      score: 35,
      level: RiskLevel.MEDIUM,
      reasons: ['HIGH_AVERAGE_TICKET'],
      assessedAt: clock.now(),
    };
  });

  it('applies the pushed result to the waiting application', async () => {
    await expect(useCase.execute(event)).resolves.toBe(RiskResultOutcome.APPLIED);
    const application = await applications.findById(event.applicationId);
    expect(application?.status).toBe(ApplicationStatus.UNDER_REVIEW);
    expect(application?.riskLevel).toBe(RiskLevel.MEDIUM);
  });

  it('ignores a redelivered event id', async () => {
    await useCase.execute(event);
    await expect(useCase.execute(event)).resolves.toBe('DUPLICATE_EVENT');
    expect(assessments.rows).toHaveLength(1);
  });

  it('does not apply a second result for the same submission under a new event id', async () => {
    await useCase.execute(event);
    const outcome = await useCase.execute({
      ...event,
      eventId: 'evt_0000000002',
      score: 90,
      level: RiskLevel.HIGH,
    });
    expect(outcome).toBe(RiskResultOutcome.ALREADY_PROCESSED);
    expect((await applications.findById(event.applicationId))?.riskLevel).toBe(RiskLevel.MEDIUM);
  });

  it('acknowledges results for unknown applications without changing anything', async () => {
    const outcome = await useCase.execute({
      ...event,
      applicationId: '00000000-0000-4000-8000-999999999999',
    });
    expect(outcome).toBe(RiskResultOutcome.APPLICATION_NOT_FOUND);
    expect(assessments.rows).toHaveLength(0);
  });
});
