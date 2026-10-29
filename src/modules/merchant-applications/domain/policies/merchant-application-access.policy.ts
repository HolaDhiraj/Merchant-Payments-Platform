import { Actor } from '../../../../shared/domain/actor';
import { Role } from '../../../../shared/domain/role.enum';
import { ApplicationStatus } from '../model/application-status.enum';
import { MerchantApplication } from '../model/merchant-application';

// Visibility restriction applied directly in the database query, so list endpoints
// can never return rows the actor is not allowed to see.
export interface ApplicationVisibilityScope {
  createdById?: string;
  excludeStatuses?: ApplicationStatus[];
}

// Object-level authorization rules (OWASP API1: Broken Object Level Authorization).
// Role guards decide which endpoints a role may call; this policy decides which
// specific applications that actor may see or change.
export class MerchantApplicationAccessPolicy {
  // ADMIN sees everything, SALES only their own, REVIEWER everything that left DRAFT.
  static canView(actor: Actor, application: MerchantApplication): boolean {
    switch (actor.role) {
      case Role.ADMIN:
        return true;
      case Role.SALES:
        return application.createdById === actor.userId;
      case Role.REVIEWER:
        return application.status !== ApplicationStatus.DRAFT;
      default:
        return false;
    }
  }

  // SALES may change only applications they created; ADMIN may change any.
  static canEdit(actor: Actor, application: MerchantApplication): boolean {
    if (actor.role === Role.ADMIN) return true;
    return actor.role === Role.SALES && application.createdById === actor.userId;
  }

  static canAssignReviewer(actor: Actor): boolean {
    return actor.role === Role.ADMIN;
  }

  // Strictly the assigned reviewer, not any reviewer and not an admin (segregation of duties).
  static canRecordDecision(actor: Actor, application: MerchantApplication): boolean {
    return actor.role === Role.REVIEWER && application.assignedReviewerId === actor.userId;
  }

  static canRetryRiskReview(actor: Actor): boolean {
    return actor.role === Role.ADMIN;
  }

  static visibilityScope(actor: Actor): ApplicationVisibilityScope {
    switch (actor.role) {
      case Role.ADMIN:
        return {};
      case Role.SALES:
        return { createdById: actor.userId };
      case Role.REVIEWER:
        return { excludeStatuses: [ApplicationStatus.DRAFT] };
      default:
        // Unknown roles see nothing (fail closed).
        return { createdById: '00000000-0000-0000-0000-000000000000' };
    }
  }
}
