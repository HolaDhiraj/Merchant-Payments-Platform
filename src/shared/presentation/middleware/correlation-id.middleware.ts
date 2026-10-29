import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { RequestContext } from '../../infrastructure/request-context/request-context';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

// Accepts a well-formed incoming correlation id or creates one, echoes it in the response,
// and stores it in the request context for logs and audit entries.
const SAFE_ID = /^[A-Za-z0-9-]{8,64}$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const incoming = request.header(CORRELATION_ID_HEADER);
    const correlationId = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
    response.setHeader(CORRELATION_ID_HEADER, correlationId);
    RequestContext.run({ correlationId }, () => next());
  }
}
