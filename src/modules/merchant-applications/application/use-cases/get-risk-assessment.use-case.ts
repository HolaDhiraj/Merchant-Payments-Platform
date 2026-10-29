import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../../shared/domain/actor';
import { EntityNotFoundError } from '../../../../shared/domain/domain-errors';
import { RiskAssessment } from '../../domain/model/risk-assessment';
import {
  RISK_ASSESSMENT_REPOSITORY,
  RiskAssessmentRepository,
} from '../../domain/ports/risk-assessment.repository';
import { MerchantApplicationReader } from '../services/merchant-application-reader';

// Returns the latest risk result (score, level, reasons) so reviewers can justify a decision.
@Injectable()
export class GetRiskAssessmentUseCase {
  constructor(
    private readonly reader: MerchantApplicationReader,
    @Inject(RISK_ASSESSMENT_REPOSITORY) private readonly assessments: RiskAssessmentRepository,
  ) {}

  async execute(actor: Actor, applicationId: string): Promise<RiskAssessment> {
    // Visibility check first, so the assessment of a hidden application is never returned.
    await this.reader.getVisible(actor, applicationId);
    const assessment = await this.assessments.findLatestByApplicationId(applicationId);
    if (!assessment) {
      throw new EntityNotFoundError('RiskAssessment', applicationId);
    }
    return assessment;
  }
}
