import { Inject, Injectable, PipeTransform } from '@nestjs/common';
import { EntityNotFoundError } from '../../../shared/domain/domain-errors';
import { Merchant } from '../domain/merchant';
import { MERCHANT_REPOSITORY, MerchantRepository } from '../domain/merchant.repository';

// Turns the :merchantId of a platform route into the merchant it names (404 when unknown).
// Platform oversight routes use it after ParseUUIDPipe:
//   @Param('merchantId', ParseUUIDPipe, MerchantByIdPipe) merchant: Merchant
@Injectable()
export class MerchantByIdPipe implements PipeTransform<string, Promise<Merchant>> {
  constructor(@Inject(MERCHANT_REPOSITORY) private readonly merchants: MerchantRepository) {}

  async transform(merchantId: string): Promise<Merchant> {
    const merchant = await this.merchants.findById(merchantId);
    if (!merchant) throw new EntityNotFoundError('Merchant', merchantId);
    return merchant;
  }
}
