import { Injectable } from '@nestjs/common';
import { Actor } from '../../../../shared/domain/actor';
import { MerchantApplication } from '../../domain/model/merchant-application';
import { MerchantApplicationReader } from '../services/merchant-application-reader';

// Returns one application if the actor is allowed to see it.
@Injectable()
export class GetMerchantApplicationUseCase {
  constructor(private readonly reader: MerchantApplicationReader) {}

  execute(actor: Actor, applicationId: string): Promise<MerchantApplication> {
    return this.reader.getVisible(actor, applicationId);
  }
}
