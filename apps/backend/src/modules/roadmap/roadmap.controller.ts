import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { RoadmapService } from './roadmap.service';
import { GenerateRoadmapDto } from './dto/generate-roadmap.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';

@ApiTags('roadmap')
@ApiBearerAuth()
@Roles(Role.student)
@Controller('roadmap')
export class RoadmapController {
  constructor(private readonly roadmap: RoadmapService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a prioritised study plan (weekly plans + daily missions)' })
  generate(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateRoadmapDto) {
    return this.roadmap.generate(user.studentProfileId, dto);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get the latest study plan with weeks and missions' })
  current(@CurrentUser() user: AuthenticatedUser) {
    return this.roadmap.getCurrent(user.studentProfileId);
  }

  @Get('missions/today')
  @ApiOperation({ summary: 'Get today’s daily missions' })
  today(@CurrentUser() user: AuthenticatedUser) {
    return this.roadmap.getTodayMissions(user.studentProfileId);
  }

  @Get('today')
  @ApiOperation({ summary: 'Daily habit view: goal, progress, streak and today’s tasks' })
  todayGoal(@CurrentUser() user: AuthenticatedUser) {
    return this.roadmap.getToday(user.studentProfileId);
  }

  @Patch('missions/:id')
  @ApiOperation({ summary: 'Mark a mission completed or skipped (completion extends the streak)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateMissionDto,
  ) {
    return this.roadmap.updateMission(user.studentProfileId, id, dto);
  }
}
