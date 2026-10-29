import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../shared/domain/role.enum';
import { Roles } from '../../../shared/presentation/decorators/roles.decorator';
import { ListAuditLogsUseCase } from '../application/list-audit-logs.use-case';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { AuditLogPageResponseDto } from './dto/audit-log-response.dto';

@ApiTags('Audit logs')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly listAuditLogs: ListAuditLogsUseCase) {}

  // Admins can inspect the audit trail, optionally filtered by entity or action.
  @Get()
  @Roles(Role.ADMIN)
  @ApiOkResponse({ type: AuditLogPageResponseDto })
  list(@Query() query: ListAuditLogsQueryDto): Promise<AuditLogPageResponseDto> {
    const { page, pageSize, entityId, action } = query;
    return this.listAuditLogs.execute({ entityId, action }, { page, pageSize });
  }
}
