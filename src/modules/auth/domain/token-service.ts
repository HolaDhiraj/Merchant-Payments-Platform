import { Role } from '../../../shared/domain/role.enum';

// Claims carried in an access token. Only identifiers, never personal data.
export interface AccessTokenClaims {
  sub: string;
  role: Role;
}

export interface IssuedToken {
  accessToken: string;
  expiresInSeconds: number;
}

// Port for issuing and verifying access tokens (JWT in infrastructure).
export interface TokenService {
  issue(claims: AccessTokenClaims): Promise<IssuedToken>;
  // Throws AuthenticationFailedError when the token is invalid or expired.
  verify(token: string): Promise<AccessTokenClaims>;
}

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');
