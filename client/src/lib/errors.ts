import { ApiError } from '@/api/http';

// A sentence suitable for showing to the user, whatever was thrown.
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "You don't have permission to do that.";
    if (error.status === 409 && error.code === 'CONCURRENCY_CONFLICT') {
      return 'Someone else changed this record just now. Reload and try again.';
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
