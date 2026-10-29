import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigType } from '@nestjs/config';
import { securityConfig } from '../../config/app.config';
import { RolesGuard } from '../../shared/presentation/guards/roles.guard';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';
import { TOKEN_SERVICE } from './domain/token-service';
import { JwtTokenService } from './infrastructure/jwt-token.service';
import { LoginUseCase } from './application/login.use-case';
import { AuthController } from './presentation/auth.controller';
import { JwtAuthGuard } from './presentation/jwt-auth.guard';

// Authentication and the global guard chain: JwtAuthGuard (who are you) runs before
// RolesGuard (is your role allowed). Object-level checks happen inside use cases.
@Module({
  imports: [
    UsersModule,
    AuditModule,
    // Secrets are passed per call from typed config, so nothing is registered globally here.
    JwtModule.register({}),
    ThrottlerModule.forRootAsync({
      inject: [securityConfig.KEY],
      useFactory: (config: ConfigType<typeof securityConfig>) => ({
        throttlers: [
          { ttl: config.loginThrottleTtlSeconds * 1000, limit: config.loginThrottleLimit },
        ],
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    LoginUseCase,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
