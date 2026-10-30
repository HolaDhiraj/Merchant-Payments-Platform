import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @Length(1, 128)
  currentPassword: string;

  // Same policy as account creation: 12+ characters with letters and digits.
  @ApiProperty({ minLength: 12, writeOnly: true })
  @IsString()
  @Length(12, 128)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'newPassword must contain letters and digits' })
  newPassword: string;
}
