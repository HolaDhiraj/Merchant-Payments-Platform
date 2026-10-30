import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { mapPage } from '../../../shared/application/pagination';
import { Role } from '../../../shared/domain/role.enum';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { UserPageResponseDto, UserResponseDto } from '../../users/presentation/dto/user-response.dto';
import { ListMerchantUsersUseCase } from '../application/merchant-team.use-cases';
import { Merchant } from '../domain/merchant';
import { ListMerchantUsersQueryDto } from './dto/merchant-team.dto';
import { MerchantByIdPipe } from './merchant-by-id.pipe';

// Platform oversight: a platform admin sees who works for a merchant (read-only).
@ApiTags('Merchants (platform)')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('merchants/:merchantId/users')
export class PlatformMerchantTeamController {
  constructor(private readonly listUsers: ListMerchantUsersUseCase) {}

  @Get()
  @ApiOkResponse({ type: UserPageResponseDto })
  async list(
    @Param('merchantId', ParseUUIDPipe, MerchantByIdPipe) merchant: Merchant,
    @Query() query: ListMerchantUsersQueryDto,
  ): Promise<UserPageResponseDto> {
    const page = await this.listUsers.forMerchant(
      merchant.id,
      { role: query.role },
      { page: query.page, pageSize: query.pageSize },
    );
    return mapPage(page, UserResponseDto.fromDomain);
  }
}
