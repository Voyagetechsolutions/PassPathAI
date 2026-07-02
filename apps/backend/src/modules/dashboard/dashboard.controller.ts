import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Roles(Role.student)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Performance dashboard: prediction, mastery, weak topics, streak' })
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getDashboard(user.studentProfileId);
  }

  @Get('predictions')
  @ApiOperation({ summary: 'Predicted-score history for trend charts' })
  predictions(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getPredictionHistory(user.studentProfileId);
  }
}
