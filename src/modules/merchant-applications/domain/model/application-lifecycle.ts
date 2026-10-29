import { InvalidStateTransitionError } from '../../../../shared/domain/domain-errors';
import { ApplicationStatus } from './application-status.enum';

// The application state machine as data. Any transition not listed here is rejected.
//
//   DRAFT ──submit──► SUBMITTED ──risk check done──► UNDER_REVIEW ──► APPROVED
//                         ▲                               │  └──────► REJECTED
//                         └────────re-submit──── INFO_REQUESTED ◄─┘
const ALLOWED_TRANSITIONS: Readonly<Record<ApplicationStatus, readonly ApplicationStatus[]>> = {
  [ApplicationStatus.DRAFT]: [ApplicationStatus.SUBMITTED],
  [ApplicationStatus.SUBMITTED]: [ApplicationStatus.UNDER_REVIEW],
  [ApplicationStatus.UNDER_REVIEW]: [
    ApplicationStatus.APPROVED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.INFO_REQUESTED,
  ],
  [ApplicationStatus.INFO_REQUESTED]: [ApplicationStatus.SUBMITTED],
  [ApplicationStatus.APPROVED]: [],
  [ApplicationStatus.REJECTED]: [],
};

// Sales may only change application data before submission or when the reviewer asks for more info.
const EDITABLE_STATUSES: readonly ApplicationStatus[] = [
  ApplicationStatus.DRAFT,
  ApplicationStatus.INFO_REQUESTED,
];

const TERMINAL_STATUSES: readonly ApplicationStatus[] = [
  ApplicationStatus.APPROVED,
  ApplicationStatus.REJECTED,
];

export const ApplicationLifecycle = {
  canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
    return ALLOWED_TRANSITIONS[from].includes(to);
  },

  assertTransition(from: ApplicationStatus, to: ApplicationStatus, action: string): void {
    if (!ApplicationLifecycle.canTransition(from, to)) {
      throw new InvalidStateTransitionError(from, action);
    }
  },

  isEditable(status: ApplicationStatus): boolean {
    return EDITABLE_STATUSES.includes(status);
  },

  isTerminal(status: ApplicationStatus): boolean {
    return TERMINAL_STATUSES.includes(status);
  },
};
