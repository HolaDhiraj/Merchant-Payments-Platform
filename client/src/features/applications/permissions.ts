import type { MerchantApplication, User } from '@/api/types';

// Mirrors MerchantApplicationAccessPolicy and the aggregate's state rules on the server, so the
// UI only offers actions that can succeed. The API remains the authority and re-checks all of it.

const EDITABLE = new Set(['DRAFT', 'INFO_REQUESTED']);
const TERMINAL = new Set(['APPROVED', 'REJECTED']);

export function canCreate(user: User): boolean {
  return user.role === 'SALES' || user.role === 'ADMIN';
}

export function canEdit(user: User, app: MerchantApplication): boolean {
  const owns = user.role === 'ADMIN' || (user.role === 'SALES' && app.createdById === user.id);
  return owns && EDITABLE.has(app.status);
}

// Submitting has the same preconditions as editing (DRAFT, or re-submit after INFO_REQUESTED).
export const canSubmit = canEdit;

export function canAssignReviewer(user: User, app: MerchantApplication): boolean {
  return user.role === 'ADMIN' && !TERMINAL.has(app.status);
}

export function canDecide(user: User, app: MerchantApplication): boolean {
  return (
    user.role === 'REVIEWER' &&
    app.assignedReviewerId === user.id &&
    app.status === 'UNDER_REVIEW' &&
    app.riskStatus === 'COMPLETED'
  );
}

export function canRetryRiskReview(user: User, app: MerchantApplication): boolean {
  return (
    user.role === 'ADMIN' &&
    app.status === 'SUBMITTED' &&
    (app.riskStatus === 'FAILED' || app.riskStatus === 'PENDING')
  );
}
