import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../shared/domain/role.enum';
import { Actor } from '../../../shared/domain/actor';
import { mapPage } from '../../../shared/application/pagination';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { CurrentActor } from '../../../shared/presentation/decorators/current-actor.decorator';
import { CreateUserUseCase } from '../application/create-user.use-case';
import { GetCurrentUserUseCase } from '../application/get-current-user.use-case';
import { ListUsersUseCase } from '../application/list-users.use-case';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserPageResponseDto, UserResponseDto } from './dto/user-response.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly listUsers: ListUsersUseCase,
    private readonly getCurrentUser: GetCurrentUserUseCase,
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
      { role: query.role },
      { page: query.page, pageSize: query.pageSize },
    );
    return mapPage(page, UserResponseDto.fromDomain);
  }

  // Any signed-in user can read their own profile.
  @Get('me')
  @ApiOkResponse({ type: UserResponseDto })
  async me(@CurrentActor() actor: Actor): Promise<UserResponseDto> {
    return UserResponseDto.fromDomain(await this.getCurrentUser.execute(actor));
  }
}
