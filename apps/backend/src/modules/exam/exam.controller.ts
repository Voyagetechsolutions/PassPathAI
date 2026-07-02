import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ExamService } from './exam.service';
import { GenerateExamDto } from './dto/generate-exam.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';

@ApiTags('exams')
@ApiBearerAuth()
@Roles(Role.student)
@Controller('exams')
export class ExamController {
  constructor(private readonly exams: ExamService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a timed mock exam paper for a subject' })
  generate(@CurrentUser() user: AuthenticatedUser, @Body() dto: GenerateExamDto) {
    return this.exams.generate(user.studentProfileId, dto);
  }

  @Post(':paperId/start')
  @ApiOperation({ summary: 'Start a timed exam attempt (returns sections + questions)' })
  start(@CurrentUser() user: AuthenticatedUser, @Param('paperId') paperId: string) {
    return this.exams.start(user.studentProfileId, paperId);
  }

  @Post('attempts/:attemptId/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit, mark, and get the performance breakdown' })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('attemptId') attemptId: string,
    @Body() dto: SubmitExamDto,
  ) {
    return this.exams.submit(user.studentProfileId, attemptId, dto);
  }

  @Get('attempts/:attemptId')
  @ApiOperation({ summary: 'Get an exam attempt with responses' })
  getAttempt(@CurrentUser() user: AuthenticatedUser, @Param('attemptId') attemptId: string) {
    return this.exams.getAttempt(user.studentProfileId, attemptId);
  }
}
