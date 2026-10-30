import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../../shared/domain/role.enum';
import { PageMetaDto } from '../../../../shared/presentation/dto/page-response.dto';
import { User } from '../../domain/user';

// Public representation of a user. The password hash is never included.
export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() fullName: string;
  @ApiProperty({ enum: Role }) role: Role;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ description: 'Locked after too many wrong passwords; an admin can unlock it' })
  isLocked: boolean;
  @ApiProperty({ type: Date, nullable: true }) lockedAt: Date | null;
  @ApiProperty() createdAt: Date;

  static fromDomain(user: User): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      isLocked: user.isLocked,
      lockedAt: user.lockedAt,
      createdAt: user.createdAt,
    };
  }
}

export class UserPageResponseDto extends PageMetaDto {
  @ApiProperty({ type: [UserResponseDto] })
  items: UserResponseDto[];
}
