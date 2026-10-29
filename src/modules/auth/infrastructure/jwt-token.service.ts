import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { jwtConfig, JwtConfig } from '../../../config/app.config';
import { Role } from '../../../shared/domain/role.enum';
import { AuthenticationFailedError } from '../../../shared/domain/domain-errors';
import { AccessTokenClaims, IssuedToken, TokenService } from '../domain/token-service';

// HS256 JWT adapter. Issuer and audience are verified so tokens minted for another
// service with the same secret are rejected.
@Injectable()
export class JwtTokenService implements TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(jwtConfig.KEY) private readonly config: JwtConfig,
  ) {}

  async issue(claims: AccessTokenClaims): Promise<IssuedToken> {
    const accessToken = await this.jwt.signAsync(
      { role: claims.role },
      {
        subject: claims.sub,
        secret: this.config.secret,
        expiresIn: this.config.expiresInSeconds,
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithm: 'HS256',
      },
    );
    return { accessToken, expiresInSeconds: this.config.expiresInSeconds };
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: string; role?: string }>(token, {
        secret: this.config.secret,
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: ['HS256'],
      });
      if (!payload.sub || !Object.values(Role).includes(payload.role as Role)) {
        throw new AuthenticationFailedError('Invalid token');
      }
      return { sub: payload.sub, role: payload.role as Role };
    } catch {
      throw new AuthenticationFailedError('Invalid or expired token');
    }
  }
}
