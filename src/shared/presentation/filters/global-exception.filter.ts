import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  AccessDeniedError,
  AuthenticationFailedError,
  BusinessRuleViolationError,
  ConcurrencyConflictError,
  DomainError,
  DuplicateEntityError,
  EntityNotFoundError,
  InvalidStateTransitionError,
} from '../../domain/domain-errors';
import { RequestContext } from '../../infrastructure/request-context/request-context';

// Single place where errors become HTTP responses.
// Domain errors map to meaningful status codes; anything unexpected becomes a generic 500
// so stack traces and internal details are never exposed to clients.
type DomainErrorClass = abstract new (...args: never[]) => DomainError;

const DOMAIN_ERROR_STATUS = new Map<DomainErrorClass, HttpStatus>([
  [EntityNotFoundError, HttpStatus.NOT_FOUND],
  [AccessDeniedError, HttpStatus.FORBIDDEN],
  [InvalidStateTransitionError, HttpStatus.CONFLICT],
  [ConcurrencyConflictError, HttpStatus.CONFLICT],
  [DuplicateEntityError, HttpStatus.CONFLICT],
  [BusinessRuleViolationError, HttpStatus.UNPROCESSABLE_ENTITY],
  [AuthenticationFailedError, HttpStatus.UNAUTHORIZED],
]);

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  correlationId?: string;
  timestamp: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const { statusCode, error, message } = this.resolve(exception);
    const body: ErrorBody = {
      statusCode,
      error,
      message,
      path: request.path,
      correlationId: RequestContext.correlationId(),
      timestamp: new Date().toISOString(),
    };

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Log only the error name and stack, never the request payload.
      const stack = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`Unhandled error on ${request.method} ${request.path}`, stack);
    }

    response.status(statusCode).json(body);
  }

  private resolve(exception: unknown): Pick<ErrorBody, 'statusCode' | 'error' | 'message'> {
    if (exception instanceof DomainError) {
      const statusCode =
        DOMAIN_ERROR_STATUS.get(exception.constructor as DomainErrorClass) ??
        HttpStatus.UNPROCESSABLE_ENTITY;
      return { statusCode, error: exception.code, message: exception.message };
    }

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      const message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? (payload as { message: string | string[] }).message
          : exception.message;
      return { statusCode: exception.getStatus(), error: exception.name, message };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
    };
  }
}
