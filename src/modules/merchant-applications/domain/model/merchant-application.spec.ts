import {
  BusinessRuleViolationError,
  InvalidStateTransitionError,
} from '../../../../shared/domain/domain-errors';
import {
  draftApplication,
  OTHER_REVIEWER_ID,
  REVIEWER_ID,
  underReviewApplication,
} from '../../../../../test/support/fakes/application-builders';
import { ApplicationStatus } from './application-status.enum';
import { MerchantApplication } from './merchant-application';
import { ReviewDecision } from './review-decision.enum';
import { RiskLevel, RiskStatus } from './risk.enums';

const NOW = new Date('2026-02-01T00:00:00.000Z');

describe('MerchantApplication aggregate', () => {
  describe('creation and editing', () => {
    it('starts in DRAFT with no risk review', () => {
      const application = draftApplication();
      expect(application.status).toBe(ApplicationStatus.DRAFT);
      expect(application.riskStatus).toBe(RiskStatus.NOT_STARTED);
      expect(application.submissionCount).toBe(0);
    });

    it('merges partial updates while editable', () => {
      const application = draftApplication();
      application.updateDetails({ businessName: 'Renamed' }, NOW);
      expect(application.details.businessName).toBe('Renamed');
      expect(application.details.legalBusinessName).toBe('Test Coffee LLC');
      expect(application.updatedAt).toEqual(NOW);
    });

    it('rejects edits once submitted', () => {
      const application = draftApplication();
      application.submit(NOW);
      expect(() => application.updateDetails({ businessName: 'Late change' }, NOW)).toThrow(
        InvalidStateTransitionError,
      );
    });

    it('enforces processing invariants on update', () => {
      const application = draftApplication();
      expect(() =>
        application.updateDetails(
          { processing: { ...application.details.processing, averageTicketMinor: 999_999_999 } },
          NOW,
        ),
      ).toThrow(BusinessRuleViolationError);
    });
  });

  describe('submission', () => {
    it('moves DRAFT to SUBMITTED with a pending risk review', () => {
      const application = draftApplication();
      const submissionNumber = application.submit(NOW);
      expect(submissionNumber).toBe(1);
      expect(application.status).toBe(ApplicationStatus.SUBMITTED);
      expect(application.riskStatus).toBe(RiskStatus.PENDING);
      expect(application.submittedAt).toEqual(NOW);
    });

    it('cannot be submitted twice', () => {
      const application = draftApplication();
      application.submit(NOW);
      expect(() => application.submit(NOW)).toThrow(InvalidStateTransitionError);
    });

    it('builds a deterministic idempotency key per submission', () => {
      expect(MerchantApplication.riskReviewIdempotencyKey('app-1', 2)).toBe('risk-review:app-1:2');
    });
  });

  describe('risk review', () => {
    it('applies a result exactly once', () => {
      const application = draftApplication();
      const submission = application.submit(NOW);

      expect(
        application.completeRiskReview(
          { submissionNumber: submission, level: RiskLevel.MEDIUM, score: 40 },
          NOW,
        ),
      ).toBe(true);
      expect(application.status).toBe(ApplicationStatus.UNDER_REVIEW);
      expect(application.riskLevel).toBe(RiskLevel.MEDIUM);

      // A redelivered job must not change anything.
      expect(
        application.completeRiskReview(
          { submissionNumber: submission, level: RiskLevel.HIGH, score: 90 },
          NOW,
        ),
      ).toBe(false);
      expect(application.riskLevel).toBe(RiskLevel.MEDIUM);
    });

    it('ignores results for a stale submission', () => {
      const application = draftApplication();
      application.submit(NOW);
      expect(
        application.completeRiskReview(
          { submissionNumber: 99, level: RiskLevel.LOW, score: 5 },
          NOW,
        ),
      ).toBe(false);
      expect(application.riskStatus).toBe(RiskStatus.PENDING);
    });

    it('rejects scores outside 0..100', () => {
      const application = draftApplication();
      const submission = application.submit(NOW);
      expect(() =>
        application.completeRiskReview(
          { submissionNumber: submission, level: RiskLevel.LOW, score: 101 },
          NOW,
        ),
      ).toThrow(BusinessRuleViolationError);
    });

    it('marks a failed review and allows a restart for the same submission', () => {
      const application = draftApplication();
      const submission = application.submit(NOW);

      expect(application.failRiskReview(submission, NOW)).toBe(true);
      expect(application.riskStatus).toBe(RiskStatus.FAILED);
      expect(application.status).toBe(ApplicationStatus.SUBMITTED);

      expect(application.restartRiskReview(NOW)).toBe(submission);
      expect(application.riskStatus).toBe(RiskStatus.PENDING);
    });

    it('cannot restart a completed review', () => {
      const application = underReviewApplication();
      expect(() => application.restartRiskReview(NOW)).toThrow(InvalidStateTransitionError);
    });
  });

  describe('reviewer decision', () => {
    it('approves when the assigned reviewer decides', () => {
      const application = underReviewApplication();
      application.recordDecision(
        { reviewerId: REVIEWER_ID, decision: ReviewDecision.APPROVE },
        NOW,
      );
      expect(application.status).toBe(ApplicationStatus.APPROVED);
      expect(application.decidedById).toBe(REVIEWER_ID);
      expect(application.decidedAt).toEqual(NOW);
    });

    it('refuses a decision from a reviewer who is not assigned', () => {
      const application = underReviewApplication();
      expect(() =>
        application.recordDecision(
          { reviewerId: OTHER_REVIEWER_ID, decision: ReviewDecision.APPROVE },
          NOW,
        ),
      ).toThrow(BusinessRuleViolationError);
      expect(application.status).toBe(ApplicationStatus.UNDER_REVIEW);
    });

    it('refuses a decision before the risk review completed', () => {
      const application = draftApplication();
      application.submit(NOW);
      application.assignReviewer(REVIEWER_ID, NOW);
      expect(() =>
        application.recordDecision(
          { reviewerId: REVIEWER_ID, decision: ReviewDecision.APPROVE },
          NOW,
        ),
      ).toThrow(InvalidStateTransitionError);
    });

    it.each([ReviewDecision.REJECT, ReviewDecision.REQUEST_INFO])(
      'requires a reason for %s',
      (decision) => {
        const application = underReviewApplication();
        expect(() =>
          application.recordDecision({ reviewerId: REVIEWER_ID, decision, reason: '  ' }, NOW),
        ).toThrow(BusinessRuleViolationError);
      },
    );

    it('requires a justification to approve a HIGH risk merchant', () => {
      const application = underReviewApplication(RiskLevel.HIGH);
      expect(() =>
        application.recordDecision(
          { reviewerId: REVIEWER_ID, decision: ReviewDecision.APPROVE },
          NOW,
        ),
      ).toThrow(BusinessRuleViolationError);

      application.recordDecision(
        {
          reviewerId: REVIEWER_ID,
          decision: ReviewDecision.APPROVE,
          reason: 'Verified with enhanced due diligence',
        },
        NOW,
      );
      expect(application.status).toBe(ApplicationStatus.APPROVED);
    });

    it('supports the request-info loop: edit, resubmit and a fresh risk review', () => {
      const application = underReviewApplication();
      application.recordDecision(
        {
          reviewerId: REVIEWER_ID,
          decision: ReviewDecision.REQUEST_INFO,
          reason: 'Need updated volume',
        },
        NOW,
      );
      expect(application.status).toBe(ApplicationStatus.INFO_REQUESTED);
      expect(application.isEditable()).toBe(true);

      application.updateDetails({ businessName: 'Updated' }, NOW);
      const second = application.submit(NOW);

      expect(second).toBe(2);
      expect(application.riskStatus).toBe(RiskStatus.PENDING);
      expect(application.decision).toBeNull();
      expect(application.assignedReviewerId).toBe(REVIEWER_ID);
    });

    it('cannot decide twice or re-assign after a final decision', () => {
      const application = underReviewApplication();
      application.recordDecision(
        { reviewerId: REVIEWER_ID, decision: ReviewDecision.REJECT, reason: 'Fraud signals' },
        NOW,
      );
      expect(() =>
        application.recordDecision(
          { reviewerId: REVIEWER_ID, decision: ReviewDecision.APPROVE },
          NOW,
        ),
      ).toThrow(InvalidStateTransitionError);
      expect(() => application.assignReviewer(OTHER_REVIEWER_ID, NOW)).toThrow(
        InvalidStateTransitionError,
      );
    });
  });

  it('never exposes the raw tax id when serialised', () => {
    const json = JSON.stringify(draftApplication().details);
    expect(json).not.toContain('000001234');
    expect(json).toContain('*****1234');
  });
});
