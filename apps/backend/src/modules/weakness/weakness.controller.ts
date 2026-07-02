import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { WeaknessService } from './weakness.service';

@ApiTags('weakness')
@ApiBearerAuth()
@Roles(Role.student)
@Controller('weakness')
export class WeaknessController {
  constructor(private readonly weakness: WeaknessService) {}

  private studentId(user: AuthenticatedUser): string {
    if (!user.studentProfileId) {
      throw new ForbiddenException('Only students have a weakness profile');
    }
    return user.studentProfileId;
  }

  @Get('weak-topics')
  @ApiOperation({ summary: 'List the current weak topics, weakest first' })
  weakTopics(@CurrentUser() user: AuthenticatedUser) {
    return this.weakness.getWeakTopics(this.studentId(user));
  }

  @Get('mastery')
  @ApiOperation({ summary: 'List topic mastery scores, lowest first' })
  mastery(@CurrentUser() user: AuthenticatedUser) {
    return this.weakness.getMastery(this.studentId(user));
  }
}
