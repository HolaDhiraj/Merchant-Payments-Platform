import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
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
  constructor(private readonly login: LoginUseCase) {}

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
}
