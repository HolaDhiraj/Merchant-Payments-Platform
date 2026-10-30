// Base class for all expected business errors. The presentation layer maps each subclass
// to an HTTP status in one place (GlobalExceptionFilter), so use cases never know about HTTP.
export abstract class DomainError extends Error {
  abstract readonly code: string;

  // Optional machine-readable details for clients (e.g. remaining sign-in attempts).
  protected constructor(
    message: string,
    readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

// The resource does not exist, or the caller is not allowed to know that it exists.
export class EntityNotFoundError extends DomainError {
  readonly code = 'ENTITY_NOT_FOUND';

  constructor(entity: string, id: string) {
    super(`${entity} ${id} was not found`);
  }
}

// The caller can see the resource but is not allowed to perform this action on it.
export class AccessDeniedError extends DomainError {
  readonly code = 'ACCESS_DENIED';

  constructor(message = 'You are not allowed to perform this action') {
    super(message);
  }
}

// The requested lifecycle transition is not allowed from the current state.
export class InvalidStateTransitionError extends DomainError {
  readonly code = 'INVALID_STATE_TRANSITION';

  constructor(from: string, action: string) {
    super(`Cannot ${action} an application in status ${from}`);
  }
}

// A business rule was violated (e.g. a rejection without a reason).
export class BusinessRuleViolationError extends DomainError {
  readonly code = 'BUSINESS_RULE_VIOLATION';

  constructor(message: string) {
    super(message);
  }
}

// Another writer changed the aggregate since it was loaded (optimistic locking).
export class ConcurrencyConflictError extends DomainError {
  readonly code = 'CONCURRENCY_CONFLICT';

  constructor(entity: string, id: string) {
    super(`${entity} ${id} was modified concurrently, reload and retry`);
  }
}

// A unique business key already exists (e.g. a user email).
export class DuplicateEntityError extends DomainError {
  readonly code = 'DUPLICATE_ENTITY';

  constructor(message: string) {
    super(message);
  }
}

// Credentials or token are missing or invalid.
export class AuthenticationFailedError extends DomainError {
  readonly code = 'AUTHENTICATION_FAILED';

  constructor(message = 'Invalid credentials', meta?: Record<string, unknown>) {
    super(message, meta);
  }
}

// The right password for an account an admin has deactivated. Only reported after the password
// matched, so the account's status is never revealed to someone guessing passwords.
export class AccountDeactivatedError extends DomainError {
  readonly code = 'ACCOUNT_DEACTIVATED';

  constructor() {
    super('This account has been deactivated. Contact an administrator to reactivate it.');
  }
}

// Too many consecutive wrong passwords; only an admin can unlock the account.
export class AccountLockedError extends DomainError {
  readonly code = 'ACCOUNT_LOCKED';

  constructor() {
    super(
      'This account is locked after too many failed sign-in attempts. Contact an administrator to unlock it.',
    );
  }
}
