import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/presentation/dto/pagination-query.dto';
import { PLATFORM_ROLES, Role } from '../../../../shared/domain/role.enum';

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PLATFORM_ROLES })
  @IsOptional()
  @IsIn(PLATFORM_ROLES)
  role?: Role;
}
