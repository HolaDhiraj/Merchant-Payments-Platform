import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { HmacWebhookSignatureVerifier } from '../../infrastructure/webhooks/hmac-webhook-signature.verifier';

export const WEBHOOK_ID_HEADER = 'x-webhook-id';
export const WEBHOOK_TIMESTAMP_HEADER = 'x-webhook-timestamp';
export const WEBHOOK_SIGNATURE_HEADER = 'x-webhook-signature';

// Authenticates webhook calls by signature instead of JWT (the caller is a machine, not a user).
// Runs before body validation, so unsigned requests are rejected without parsing their content further.
@Injectable()
export class RiskWebhookSignatureGuard implements CanActivate {
  constructor(private readonly verifier: HmacWebhookSignatureVerifier) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();
    this.verifier.verify({
      eventId: request.header(WEBHOOK_ID_HEADER),
      timestamp: request.header(WEBHOOK_TIMESTAMP_HEADER),
      signatureHeader: request.header(WEBHOOK_SIGNATURE_HEADER),
      rawBody: request.rawBody,
    });
    return true;
  }
}
