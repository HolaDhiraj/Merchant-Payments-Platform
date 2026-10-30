import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Actor } from '../../../shared/domain/actor';
import { MERCHANT_ROLES, Role } from '../../../shared/domain/role.enum';
import { CurrentActor } from '../../../shared/presentation/decorators/current-actor.decorator';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import {
  CurrentMerchantReader,
  UpdateMerchantSettingsUseCase,
} from '../application/merchant-profile.use-cases';
import { MerchantResponseDto } from './dto/merchant-response.dto';
import { UpdateMerchantSettingsDto } from './dto/update-merchant-settings.dto';

// The signed-in merchant user's own business. The merchant comes from the session, never the URL.
@ApiTags('Merchant portal')
@ApiBearerAuth()
@Roles(...MERCHANT_ROLES)
@Controller('merchant')
export class MerchantPortalController {
  constructor(
    private readonly currentMerchant: CurrentMerchantReader,
    private readonly updateSettings: UpdateMerchantSettingsUseCase,
  ) {}

  @Get('profile')
  @ApiOkResponse({ type: MerchantResponseDto })
  async profile(@CurrentActor() actor: Actor): Promise<MerchantResponseDto> {
    return MerchantResponseDto.fromDomain(await this.currentMerchant.get(actor));
  }

  @Patch('settings')
  @Roles(Role.MERCHANT_ADMIN)
  @ApiOkResponse({ type: MerchantResponseDto })
  async settings(
    @CurrentActor() actor: Actor,
    @Body() dto: UpdateMerchantSettingsDto,
  ): Promise<MerchantResponseDto> {
    return MerchantResponseDto.fromDomain(await this.updateSettings.execute(actor, dto));
  }
}
