import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { mapPage } from '../../../shared/application/pagination';
import { Actor } from '../../../shared/domain/actor';
import { Role } from '../../../shared/domain/role.enum';
import { CurrentActor } from '../../../shared/presentation/decorators/current-actor.decorator';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import {
  GetMerchantUseCase,
  IssueOwnerPasswordUseCase,
  ListMerchantsUseCase,
} from '../application/platform-merchants.use-cases';
import { MerchantListQueryDto } from './dto/merchant-team.dto';
import {
  MerchantPageResponseDto,
  MerchantResponseDto,
  TemporaryPasswordResponseDto,
} from './dto/merchant-response.dto';

// Platform view of onboarded merchants (platform admins only).
@ApiTags('Merchants (platform)')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('merchants')
export class MerchantsController {
  constructor(
    private readonly listMerchants: ListMerchantsUseCase,
    private readonly getMerchant: GetMerchantUseCase,
    private readonly issueOwnerPassword: IssueOwnerPasswordUseCase,
  ) {}

  @Get()
  @ApiOkResponse({ type: MerchantPageResponseDto })
  async list(@Query() query: MerchantListQueryDto): Promise<MerchantPageResponseDto> {
    const page = await this.listMerchants.execute(
      { text: query.q },
      { page: query.page, pageSize: query.pageSize },
    );
    return mapPage(page, (merchant) => MerchantResponseDto.fromDomain(merchant));
  }

  @Get('by-application/:applicationId')
  @ApiOkResponse({ type: MerchantResponseDto })
  async byApplication(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ): Promise<MerchantResponseDto> {
    const { merchant, owner } = await this.getMerchant.byApplicationId(applicationId);
    return MerchantResponseDto.fromDomain(merchant, owner);
  }

  @Get(':id')
  @ApiOkResponse({ type: MerchantResponseDto })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<MerchantResponseDto> {
    const { merchant, owner } = await this.getMerchant.byId(id);
    return MerchantResponseDto.fromDomain(merchant, owner);
  }

  // A new one-time password for the owner (lost hand-over, lockout).
  @Post(':id/owner/temporary-password')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: TemporaryPasswordResponseDto })
  async resetOwnerPassword(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TemporaryPasswordResponseDto> {
    const { owner, temporaryPassword } = await this.issueOwnerPassword.execute(actor, id);
    return { userId: owner.id, email: owner.email, temporaryPassword };
  }
}
