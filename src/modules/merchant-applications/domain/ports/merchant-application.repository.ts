import { Page, PageRequest } from '../../../../shared/application/pagination';
import { ApplicationStatus } from '../model/application-status.enum';
import { MerchantApplication } from '../model/merchant-application';
import { ApplicationVisibilityScope } from '../policies/merchant-application-access.policy';

export interface ApplicationSearchCriteria {
  scope: ApplicationVisibilityScope;
  status?: ApplicationStatus;
  assignedReviewerId?: string;
}

// Persistence port for the aggregate.
// update() uses optimistic locking and throws ConcurrencyConflictError on a stale version.
export interface MerchantApplicationRepository {
  findById(id: string): Promise<MerchantApplication | null>;
  insert(application: MerchantApplication): Promise<void>;
  update(application: MerchantApplication): Promise<void>;
  search(
    criteria: ApplicationSearchCriteria,
    page: PageRequest,
  ): Promise<Page<MerchantApplication>>;
}

export const MERCHANT_APPLICATION_REPOSITORY = Symbol('MERCHANT_APPLICATION_REPOSITORY');
