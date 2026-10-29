import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../../shared/domain/actor';
import { Page, PageRequest } from '../../../../shared/application/pagination';
import { ApplicationStatus } from '../../domain/model/application-status.enum';
import { MerchantApplication } from '../../domain/model/merchant-application';
import { MerchantApplicationAccessPolicy } from '../../domain/policies/merchant-application-access.policy';
import {
  MERCHANT_APPLICATION_REPOSITORY,
  MerchantApplicationRepository,
} from '../../domain/ports/merchant-application.repository';

export interface ListApplicationsQuery {
  status?: ApplicationStatus;
  assignedToMe?: boolean;
  page: PageRequest;
}

// Lists applications visible to the actor, filtered by status, newest first.
// The visibility scope is pushed into the SQL query, never filtered in memory.
@Injectable()
export class ListMerchantApplicationsUseCase {
  constructor(
    @Inject(MERCHANT_APPLICATION_REPOSITORY)
    private readonly applications: MerchantApplicationRepository,
  ) {}

  execute(actor: Actor, query: ListApplicationsQuery): Promise<Page<MerchantApplication>> {
    return this.applications.search(
      {
        scope: MerchantApplicationAccessPolicy.visibilityScope(actor),
        status: query.status,
        assignedReviewerId: query.assignedToMe ? actor.userId : undefined,
      },
      query.page,
    );
  }
}
