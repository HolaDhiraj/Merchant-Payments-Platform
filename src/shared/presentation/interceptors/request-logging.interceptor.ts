import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { RequestContext } from '../../infrastructure/request-context/request-context';

// Structured access log: method, route, status and duration only.
// Bodies, headers and query strings are deliberately not logged, so tokens, passwords
// and personal data can never leak through this path.
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(request, http.getResponse<Response>().statusCode, startedAt),
        error: () => this.log(request, undefined, startedAt),
      }),
    );
  }

  private log(request: Request, statusCode: number | undefined, startedAt: number): void {
    this.logger.log(
      JSON.stringify({
        method: request.method,
        path: request.route?.path ?? request.path,
        statusCode: statusCode ?? 'error',
        durationMs: Date.now() - startedAt,
        correlationId: RequestContext.correlationId(),
      }),
    );
  }
}
