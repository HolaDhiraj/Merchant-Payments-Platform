import {
  BusinessDetails,
  BusinessType,
  SalesChannel,
} from '../../../src/modules/merchant-applications/domain/model/business-details';
import { MerchantApplication } from '../../../src/modules/merchant-applications/domain/model/merchant-application';
import { RiskLevel } from '../../../src/modules/merchant-applications/domain/model/risk.enums';
import { TaxId } from '../../../src/modules/merchant-applications/domain/model/tax-id';
import { BusinessDetailsInput } from '../../../src/modules/merchant-applications/application/services/business-details.input';

// Synthetic, obviously fake test data only (no real people, businesses or tax ids).
export const SALES_ID = '00000000-0000-4000-8000-00000000a001';
export const OTHER_SALES_ID = '00000000-0000-4000-8000-00000000a002';
export const REVIEWER_ID = '00000000-0000-4000-8000-00000000b001';
export const OTHER_REVIEWER_ID = '00000000-0000-4000-8000-00000000b002';
export const ADMIN_ID = '00000000-0000-4000-8000-00000000c001';

export function detailsInput(overrides: Partial<BusinessDetailsInput> = {}): BusinessDetailsInput {
  return {
    businessName: 'Test Coffee',
    legalBusinessName: 'Test Coffee LLC',
    businessType: BusinessType.LLC,
    taxId: '00-0001234',
    owner: { fullName: 'Test Owner', email: 'owner@example.test', phone: '+15555550100' },
    processing: {
      merchantCategoryCode: '5812',
      currency: 'USD',
      expectedMonthlyVolumeMinor: 2_500_000,
      averageTicketMinor: 4_500,
      salesChannel: SalesChannel.CARD_PRESENT,
    },
    ...overrides,
  };
}

export function businessDetails(overrides: Partial<BusinessDetails> = {}): BusinessDetails {
  const input = detailsInput();
  return { ...input, taxId: TaxId.of(input.taxId), ...overrides };
}

export function draftApplication(
  id = '00000000-0000-4000-8000-0000000000aa',
  createdById = SALES_ID,
): MerchantApplication {
  return MerchantApplication.create({
    id,
    createdById,
    details: businessDetails(),
    now: new Date('2026-01-01T00:00:00.000Z'),
  });
}

// Drives an application to UNDER_REVIEW with an assigned reviewer.
export function underReviewApplication(
  level = RiskLevel.LOW,
  reviewerId = REVIEWER_ID,
): MerchantApplication {
  const application = draftApplication();
  const now = new Date('2026-01-02T00:00:00.000Z');
  const submission = application.submit(now);
  application.completeRiskReview(
    { submissionNumber: submission, level, score: level === RiskLevel.HIGH ? 80 : 10 },
    now,
  );
  application.assignReviewer(reviewerId, now);
  return application;
}
