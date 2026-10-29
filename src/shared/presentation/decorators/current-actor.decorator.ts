import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { Actor } from '../../domain/actor';

// Express request after the JwtAuthGuard has attached the verified caller.
export interface AuthenticatedRequest extends Request {
  actor?: Actor;
}

// Injects the authenticated actor into a controller method parameter.
export const CurrentActor = createParamDecorator((_data: unknown, ctx: ExecutionContext): Actor => {
  const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.actor) {
    // Only reachable if a route is misconfigured as public while reading the actor.
    throw new Error('CurrentActor used on a route without authentication');
  }
  return request.actor;
});
