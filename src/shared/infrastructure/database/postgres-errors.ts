import { QueryFailedError } from 'typeorm';

// PostgreSQL error code for a unique constraint violation.
const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as { code?: string; constraint?: string };
  if (driverError.code !== UNIQUE_VIOLATION) {
    return false;
  }
  return constraint === undefined || driverError.constraint === constraint;
}
