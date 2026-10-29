import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'sales@example.test' })
  @IsEmail()
  email: string;

  @ApiProperty({ writeOnly: true })
  @IsString()
  @Length(1, 128)
  password: string;
}
