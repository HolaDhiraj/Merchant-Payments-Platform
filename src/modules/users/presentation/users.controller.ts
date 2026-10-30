import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Role } from '../../../shared/domain/role.enum';
import { Actor } from '../../../shared/domain/actor';
import { mapPage } from '../../../shared/application/pagination';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { CurrentActor } from '../../../shared/presentation/decorators/current-actor.decorator';
import { AllowTemporaryPassword } from '../../../shared/presentation/decorators/allow-temporary-password.decorator';
import { CreateUserUseCase } from '../application/create-user.use-case';
import { GetCurrentUserUseCase } from '../application/get-current-user.use-case';
import { ListUsersUseCase } from '../application/list-users.use-case';
import { SetUserActiveUseCase } from '../application/set-user-active.use-case';
import { UnlockUserUseCase } from '../application/unlock-user.use-case';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UserPageResponseDto, UserResponseDto } from './dto/user-response.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly listUsers: ListUsersUseCase,
    private readonly getCurrentUser: GetCurrentUserUseCase,
    private readonly unlockUser: UnlockUserUseCase,
    private readonly setUserActive: SetUserActiveUseCase,
  ) {}

  // Admins provision reviewer and sales accounts.
  @Post()
  @Roles(Role.ADMIN)
  @ApiCreatedResponse({ type: UserResponseDto })
  async create(@CurrentActor() actor: Actor, @Body() dto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.createUser.execute(actor, dto);
    return UserResponseDto.fromDomain(user);
  }

  // Admins browse the team, e.g. to find a reviewer to assign.
  @Get()
  @Roles(Role.ADMIN)
  @ApiOkResponse({ type: UserPageResponseDto })
  async list(@Query() query: ListUsersQueryDto): Promise<UserPageResponseDto> {
    const page = await this.listUsers.execute(
      { role: query.role, merchantId: null },
      { page: query.page, pageSize: query.pageSize },
    );
    return mapPage(page, UserResponseDto.fromDomain);
  }

  // Admins lift a lockout caused by too many wrong passwords.
  @Post(':id/unlock')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'The account is not locked' })
  async unlock(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    return UserResponseDto.fromDomain(await this.unlockUser.execute(actor, id));
  }

  // Admins deactivate an account (sign-in refused, sessions end) or reactivate it.
  @Patch(':id/status')
  @Roles(Role.ADMIN)
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnprocessableEntityResponse({ description: 'An admin cannot deactivate their own account' })
  async updateStatus(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<UserResponseDto> {
    return UserResponseDto.fromDomain(await this.setUserActive.execute(actor, id, dto.isActive));
  }

  // Any signed-in user can read their own profile, even before replacing a temporary password.
  @Get('me')
  @AllowTemporaryPassword()
  @ApiOkResponse({ type: UserResponseDto })
  async me(@CurrentActor() actor: Actor): Promise<UserResponseDto> {
    return UserResponseDto.fromDomain(await this.getCurrentUser.execute(actor));
  }
}
