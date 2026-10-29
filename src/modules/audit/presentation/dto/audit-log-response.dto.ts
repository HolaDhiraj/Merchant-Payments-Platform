import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageMetaDto } from '../../../../shared/presentation/dto/page-response.dto';
import { AuditAction } from '../../domain/audit-action.enum';

export class AuditLogResponseDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional({ nullable: true }) actorId: string | null;
  @ApiProperty() actorRole: string;
  @ApiProperty({ enum: AuditAction }) action: AuditAction;
  @ApiProperty() entityType: string;
  @ApiProperty() entityId: string;
  @ApiProperty({ type: 'object', additionalProperties: true }) metadata: Record<string, unknown>;
  @ApiPropertyOptional({ nullable: true }) correlationId: string | null;
  @ApiProperty() occurredAt: Date;
}

export class AuditLogPageResponseDto extends PageMetaDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  items: AuditLogResponseDto[];
}
