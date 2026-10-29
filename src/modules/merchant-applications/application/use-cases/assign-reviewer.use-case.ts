import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../../shared/domain/actor';
import { Clock, CLOCK } from '../../../../shared/domain/clock';
import {
  AccessDeniedError,
  BusinessRuleViolationError,
} from '../../../../shared/domain/domain-errors';
import { UNIT_OF_WORK, UnitOfWork } from '../../../../shared/application/unit-of-work';
import { AuditLogger } from '../../../audit/application/audit-logger';
import { AuditAction } from '../../../audit/domain/audit-action.enum';
import { USER_REPOSITORY, UserRepository } from '../../../users/domain/user.repository';
import { MerchantApplication } from '../../domain/model/merchant-application';
import { MerchantApplicationAccessPolicy } from '../../domain/policies/merchant-application-access.policy';
import {
  MERCHANT_APPLICATION_REPOSITORY,
  MerchantApplicationRepository,
} from '../../domain/ports/merchant-application.repository';
import { MerchantApplicationReader } from '../services/merchant-application-reader';

// Assigns an active REVIEWER to an application (ADMIN only).
@Injectable()
export class AssignReviewerUseCase {
  constructor(
    private readonly reader: MerchantApplicationReader,
    @Inject(MERCHANT_APPLICATION_REPOSITORY)
    private readonly applications: MerchantApplicationRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditLogger,
  ) {}

  async execute(
    actor: Actor,
    applicationId: string,
    reviewerId: string,
  ): Promise<MerchantApplication> {
    if (!MerchantApplicationAccessPolicy.canAssignReviewer(actor)) {
      throw new AccessDeniedError('Only an admin can assign reviewers');
    }

    const reviewer = await this.users.findById(reviewerId);
    if (!reviewer || !reviewer.canReview()) {
      throw new BusinessRuleViolationError(
        'Assignee must be an active user with the REVIEWER role',
      );
    }

    return this.unitOfWork.run(async () => {
      const application = await this.reader.getVisible(actor, applicationId);
      const previousReviewerId = application.assignedReviewerId;
      application.assignReviewer(reviewer.id, this.clock.now());
      await this.applications.update(application);
      await this.audit.record({
        actor,
        action: AuditAction.REVIEWER_ASSIGNED,
        entityType: 'MerchantApplication',
        entityId: application.id,
        metadata: { reviewerId: reviewer.id, previousReviewerId },
      });
      return application;
    });
  }
}
