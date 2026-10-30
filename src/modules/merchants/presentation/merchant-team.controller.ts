import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { mapPage } from '../../../shared/application/pagination';
import { Actor } from '../../../shared/domain/actor';
import { Role } from '../../../shared/domain/role.enum';
import { CurrentActor } from '../../../shared/presentation/decorators/current-actor.decorator';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { UpdateUserStatusDto } from '../../users/presentation/dto/update-user-status.dto';
import { UserPageResponseDto, UserResponseDto } from '../../users/presentation/dto/user-response.dto';
import {
  AddMerchantUserUseCase,
  ListMerchantUsersUseCase,
  ResetMerchantUserPasswordUseCase,
  SetMerchantUserActiveUseCase,
} from '../application/merchant-team.use-cases';
import {
  AddMerchantUserDto,
  CreatedMerchantUserResponseDto,
  ListMerchantUsersQueryDto,
} from './dto/merchant-team.dto';
import { TemporaryPasswordResponseDto } from './dto/merchant-response.dto';

// The merchant admin's own team. Users of other merchants are invisible (404).
@ApiTags('Merchant portal')
@ApiBearerAuth()
@Roles(Role.MERCHANT_ADMIN)
@Controller('merchant/users')
export class MerchantTeamController {
  constructor(
    private readonly listUsers: ListMerchantUsersUseCase,
    private readonly addUser: AddMerchantUserUseCase,
    private readonly setActive: SetMerchantUserActiveUseCase,
    private readonly resetPassword: ResetMerchantUserPasswordUseCase,
  ) {}

  @Get()
  @ApiOkResponse({ type: UserPageResponseDto })
  async list(
    @CurrentActor() actor: Actor,
    @Query() query: ListMerchantUsersQueryDto,
  ): Promise<UserPageResponseDto> {
    const page = await this.listUsers.execute(
      actor,
      { role: query.role },
      { page: query.page, pageSize: query.pageSize },
    );
    return mapPage(page, UserResponseDto.fromDomain);
  }

  @Post()
  @ApiCreatedResponse({ type: CreatedMerchantUserResponseDto })
  async add(
    @CurrentActor() actor: Actor,
    @Body() dto: AddMerchantUserDto,
  ): Promise<CreatedMerchantUserResponseDto> {
    const { user, temporaryPassword } = await this.addUser.execute(actor, dto);
    return { user: UserResponseDto.fromDomain(user), temporaryPassword };
  }

  @Patch(':id/status')
  @ApiOkResponse({ type: UserResponseDto })
  async updateStatus(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<UserResponseDto> {
    return UserResponseDto.fromDomain(await this.setActive.execute(actor, id, dto.isActive));
  }

  // Forgotten password or lockout: issues a new one-time password and lifts the lock.
  @Post(':id/temporary-password')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({ type: TemporaryPasswordResponseDto })
  async reset(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TemporaryPasswordResponseDto> {
    const { user, temporaryPassword } = await this.resetPassword.execute(actor, id);
    return { userId: user.id, email: user.email, temporaryPassword };
  }
}
