import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, Length, Matches } from 'class-validator';
import { PLATFORM_ROLES, Role } from '../../../../shared/domain/role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'reviewer.one@example.test' })
  @IsEmail()
  @Length(3, 320)
  email: string;

  @ApiProperty({ example: 'Riley Reviewer' })
  @IsString()
  @Length(2, 200)
  fullName: string;

  // Platform staff only; merchant users are created inside their merchant portal.
  @ApiProperty({ enum: PLATFORM_ROLES })
  @IsIn(PLATFORM_ROLES)
  role: Role;

  // Minimum 12 characters with at least one letter and one digit.
  @ApiProperty({ minLength: 12, writeOnly: true })
  @IsString()
  @Length(12, 128)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'password must contain letters and digits' })
  password: string;
}
