import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../shared/domain/role.enum';
import { Actor } from '../../../shared/domain/actor';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { CurrentActor } from '../../../shared/presentation/decorators/current-actor.decorator';
import { CreateUserUseCase } from '../application/create-user.use-case';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly createUser: CreateUserUseCase) {}

  // Admins provision reviewer and sales accounts.
  @Post()
  @Roles(Role.ADMIN)
  @ApiCreatedResponse({ type: UserResponseDto })
  async create(@CurrentActor() actor: Actor, @Body() dto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.createUser.execute(actor, dto);
    return UserResponseDto.fromDomain(user);
  }
}
