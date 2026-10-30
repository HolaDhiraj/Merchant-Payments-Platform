import { MerchantApplication } from '../../domain/model/merchant-application';
import { OnboardingRequest } from '../../domain/ports/merchant-onboarding';

export function toOnboardingRequest(application: MerchantApplication): OnboardingRequest {
  const { details } = application;
  return {
    applicationId: application.id,
    tradingName: details.businessName,
    legalName: details.legalBusinessName,
    businessType: details.businessType,
    merchantCategoryCode: details.processing.merchantCategoryCode,
    currency: details.processing.currency,
    owner: { ...details.owner },
  };
}
