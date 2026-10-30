import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { MERCHANT_ROLES, Role } from '../../../../shared/domain/role.enum';
import { PaginationQueryDto } from '../../../../shared/presentation/dto/pagination-query.dto';
import { UserResponseDto } from '../../../users/presentation/dto/user-response.dto';

export class AddMerchantUserDto {
  @ApiProperty() @IsEmail() @Length(3, 320) email: string;
  @ApiProperty() @IsString() @Length(2, 200) fullName: string;
  @ApiProperty({ enum: MERCHANT_ROLES }) @IsIn(MERCHANT_ROLES) role: Role;
}

export class ListMerchantUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MERCHANT_ROLES }) @IsOptional() @IsIn(MERCHANT_ROLES) role?: Role;
}

export class MerchantListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches trading name, legal name or contact email' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  q?: string;
}

export class CreatedMerchantUserResponseDto {
  @ApiProperty({ type: UserResponseDto }) user: UserResponseDto;
  @ApiProperty({ description: 'One-time password; must be changed at first sign-in' })
  temporaryPassword: string;
}
