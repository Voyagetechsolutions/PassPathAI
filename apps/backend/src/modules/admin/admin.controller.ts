import { Body, Controller, Get, Param, Patch, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpsertAiSettingDto } from './dto/upsert-ai-setting.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.admin)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List users (optionally filtered by role)' })
  @ApiQuery({ name: 'role', required: false, enum: Role })
  listUsers(@Query('role') role?: Role) {
    return this.admin.listUsers(role);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Suspend or reactivate a user' })
  setStatus(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.admin.setUserStatus(actorId, id, dto.isActive);
  }

  @Get('ai-settings')
  @ApiOperation({ summary: 'List AI settings' })
  listSettings() {
    return this.admin.listAiSettings();
  }

  @Put('ai-settings')
  @ApiOperation({ summary: 'Create or update an AI setting' })
  upsertSetting(@CurrentUser('id') actorId: string, @Body() dto: UpsertAiSettingDto) {
    return this.admin.upsertAiSetting(actorId, dto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Platform statistics' })
  stats() {
    return this.admin.getStats();
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Recent audit log entries' })
  auditLogs() {
    return this.admin.listAuditLogs();
  }
}
