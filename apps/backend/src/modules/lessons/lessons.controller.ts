import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LessonStatus, Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { LessonsService } from './lessons.service';
import { LessonFeedbackDto } from './dto/lesson-feedback.dto';
import { ExplainLessonDto, SetLessonStatusDto } from './dto/explain-lesson.dto';

@ApiTags('lessons')
@ApiBearerAuth()
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessons: LessonsService) {}

  @Get('topic/:topicId')
  @ApiOperation({ summary: 'Get the stored lesson for a topic (drafted on first request)' })
  getForTopic(@Param('topicId') topicId: string) {
    return this.lessons.getForTopic(topicId);
  }

  @Post('topic/:topicId/feedback')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.student)
  @ApiOperation({ summary: 'Rate whether a lesson was helpful' })
  feedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('topicId') topicId: string,
    @Body() dto: LessonFeedbackDto,
  ) {
    return this.lessons.recordFeedback(user.studentProfileId ?? user.id, topicId, dto.helpful);
  }

  @Post('topic/:topicId/explain')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.student)
  @ApiOperation({ summary: 'Re-explain the lesson in a teaching style (struggling, simple, analogy…)' })
  explain(@Param('topicId') topicId: string, @Body() dto: ExplainLessonDto) {
    return this.lessons.explainInStyle(topicId, dto.style);
  }

  @Post('topic/:topicId/generate')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Admin: (re)draft the lesson for a topic' })
  generate(@Param('topicId') topicId: string) {
    return this.lessons.generateAndStore(topicId);
  }

  @Post('topic/:topicId/status')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Admin/reviewer: move a lesson through DRAFT → REVIEWED → PUBLISHED' })
  setStatus(@Param('topicId') topicId: string, @Body() dto: SetLessonStatusDto) {
    return this.lessons.setStatus(topicId, dto.status as LessonStatus);
  }
}
