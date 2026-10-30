import { Actor } from '../domain/actor';
import { AccessDeniedError } from '../domain/domain-errors';
import { isMerchantRole } from '../domain/role.enum';

// The tenant of a merchant-portal request. It always comes from the authenticated user,
// never from the URL or body, so one merchant can never address another merchant's data.
export function merchantIdOf(actor: Actor): string {
  if (!actor.merchantId || !isMerchantRole(actor.role)) {
    throw new AccessDeniedError('Only merchant users can use the merchant portal');
  }
  return actor.merchantId;
}
