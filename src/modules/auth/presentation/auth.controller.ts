import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Actor } from '../../../shared/domain/actor';
import { AllowTemporaryPassword } from '../../../shared/presentation/decorators/allow-temporary-password.decorator';
import { CurrentActor } from '../../../shared/presentation/decorators/current-actor.decorator';
import { ChangePasswordUseCase } from '../application/change-password.use-case';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../../../shared/presentation/decorators/public.decorator';
import { LoginUseCase } from '../application/login.use-case';
import { LoginDto } from './dto/login.dto';
import { TokenResponseDto } from './dto/token-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginUseCase,
    private readonly changePassword: ChangePasswordUseCase,
  ) {}

  // Rate limited per client IP to slow down credential stuffing.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiTooManyRequestsResponse({ description: 'Too many login attempts' })
  async signIn(@Body() dto: LoginDto): Promise<TokenResponseDto> {
    const token = await this.login.execute(dto);
    return {
      accessToken: token.accessToken,
      tokenType: 'Bearer',
      expiresIn: token.expiresInSeconds,
    };
  }

  // Rate limited like sign-in, because it also checks a password.
  @Post('change-password')
  @AllowTemporaryPassword()
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiNoContentResponse({ description: 'Password changed; the temporary-password flag is cleared' })
  @ApiUnauthorizedResponse({ description: 'Current password is not correct' })
  async replacePassword(@CurrentActor() actor: Actor, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.changePassword.execute(actor, dto);
  }
}
