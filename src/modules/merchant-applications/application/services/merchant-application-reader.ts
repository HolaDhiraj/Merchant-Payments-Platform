import { Inject, Injectable } from '@nestjs/common';
import { Actor } from '../../../../shared/domain/actor';
import { EntityNotFoundError } from '../../../../shared/domain/domain-errors';
import { MerchantApplication } from '../../domain/model/merchant-application';
import { MerchantApplicationAccessPolicy } from '../../domain/policies/merchant-application-access.policy';
import {
  MERCHANT_APPLICATION_REPOSITORY,
  MerchantApplicationRepository,
} from '../../domain/ports/merchant-application.repository';

// Loads an application on behalf of an actor and enforces visibility in one place.
// An application the actor may not see is reported as "not found" (404, not 403),
// so callers cannot discover which ids exist.
@Injectable()
export class MerchantApplicationReader {
  constructor(
    @Inject(MERCHANT_APPLICATION_REPOSITORY)
    private readonly applications: MerchantApplicationRepository,
  ) {}

  async getVisible(actor: Actor, applicationId: string): Promise<MerchantApplication> {
    const application = await this.applications.findById(applicationId);
    if (!application || !MerchantApplicationAccessPolicy.canView(actor, application)) {
      throw new EntityNotFoundError('MerchantApplication', applicationId);
    }
    return application;
  }

  // For write operations: hidden applications are 404, visible but not editable ones are 404 too
  // for SALES (another user's application must look exactly like a missing one).
  async getEditable(actor: Actor, applicationId: string): Promise<MerchantApplication> {
    const application = await this.getVisible(actor, applicationId);
    if (!MerchantApplicationAccessPolicy.canEdit(actor, application)) {
      throw new EntityNotFoundError('MerchantApplication', applicationId);
    }
    return application;
  }
}
