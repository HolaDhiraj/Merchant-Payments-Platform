import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AuthenticationFailedError,
  PasswordChangeRequiredError,
} from '../../../shared/domain/domain-errors';
import { ALLOW_TEMPORARY_PASSWORD_KEY } from '../../../shared/presentation/decorators/allow-temporary-password.decorator';
import { IS_PUBLIC_KEY } from '../../../shared/presentation/decorators/public.decorator';
import { AuthenticatedRequest } from '../../../shared/presentation/decorators/current-actor.decorator';
import { USER_REPOSITORY, UserRepository } from '../../users/domain/user.repository';
import { TOKEN_SERVICE, TokenService } from '../domain/token-service';

// Global authentication guard: every route requires a valid Bearer token unless marked @Public().
// The user is re-loaded on each request so deactivation and role changes take effect immediately,
// and the role and merchant (tenant) used for authorization come from the database, not the token.
// Users holding a temporary password can only reach routes marked @AllowTemporaryPassword().
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new AuthenticationFailedError('Missing bearer token');
    }

    const claims = await this.tokens.verify(token);
    const user = await this.users.findById(claims.sub);
    if (!user || !user.isActive) {
      throw new AuthenticationFailedError('Invalid or expired token');
    }

    const allowsTemporaryPassword = this.reflector.getAllAndOverride<boolean>(
      ALLOW_TEMPORARY_PASSWORD_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (user.mustChangePassword && !allowsTemporaryPassword) {
      throw new PasswordChangeRequiredError();
    }

    request.actor = { userId: user.id, role: user.role, merchantId: user.merchantId };
    return true;
  }

  private extractBearerToken(header: string | undefined): string | null {
    if (!header) return null;
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : null;
  }
}
