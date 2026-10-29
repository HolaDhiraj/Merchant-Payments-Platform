import { Role } from '../../../../shared/domain/role.enum';
import {
  ADMIN_ID,
  draftApplication,
  OTHER_REVIEWER_ID,
  OTHER_SALES_ID,
  REVIEWER_ID,
  SALES_ID,
  underReviewApplication,
} from '../../../../../test/support/fakes/application-builders';
import { ApplicationStatus } from '../model/application-status.enum';
import { MerchantApplicationAccessPolicy as Policy } from './merchant-application-access.policy';

const admin = { userId: ADMIN_ID, role: Role.ADMIN };
const owner = { userId: SALES_ID, role: Role.SALES };
const otherSales = { userId: OTHER_SALES_ID, role: Role.SALES };
const reviewer = { userId: REVIEWER_ID, role: Role.REVIEWER };
const otherReviewer = { userId: OTHER_REVIEWER_ID, role: Role.REVIEWER };

describe('MerchantApplicationAccessPolicy', () => {
  describe('SALES object-level isolation', () => {
    it('lets the creator view and edit', () => {
      const application = draftApplication();
      expect(Policy.canView(owner, application)).toBe(true);
      expect(Policy.canEdit(owner, application)).toBe(true);
    });

    it("hides another sales user's application", () => {
      const application = draftApplication();
      expect(Policy.canView(otherSales, application)).toBe(false);
      expect(Policy.canEdit(otherSales, application)).toBe(false);
    });

    it('scopes list queries to the creator', () => {
      expect(Policy.visibilityScope(owner)).toEqual({ createdById: SALES_ID });
    });
  });

  describe('REVIEWER', () => {
    it('cannot see drafts but can see submitted applications', () => {
      expect(Policy.canView(reviewer, draftApplication())).toBe(false);
      expect(Policy.canView(reviewer, underReviewApplication())).toBe(true);
      expect(Policy.visibilityScope(reviewer)).toEqual({
        excludeStatuses: [ApplicationStatus.DRAFT],
      });
    });

    it('can never edit', () => {
      expect(Policy.canEdit(reviewer, underReviewApplication())).toBe(false);
    });

    it('only the assigned reviewer can record a decision', () => {
      const application = underReviewApplication();
      expect(Policy.canRecordDecision(reviewer, application)).toBe(true);
      expect(Policy.canRecordDecision(otherReviewer, application)).toBe(false);
    });
  });

  describe('ADMIN', () => {
    it('has operational access but cannot record review decisions', () => {
      const application = underReviewApplication();
      expect(Policy.canView(admin, application)).toBe(true);
      expect(Policy.canEdit(admin, application)).toBe(true);
      expect(Policy.canAssignReviewer(admin)).toBe(true);
      expect(Policy.canRecordDecision(admin, application)).toBe(false);
      expect(Policy.visibilityScope(admin)).toEqual({});
    });

    it('is the only role that can assign reviewers or retry risk reviews', () => {
      for (const actor of [owner, reviewer]) {
        expect(Policy.canAssignReviewer(actor)).toBe(false);
        expect(Policy.canRetryRiskReview(actor)).toBe(false);
      }
    });
  });
});
