import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PracticeService } from './practice.service';
import { AnswerDto } from './dto/answer.dto';

@ApiTags('practice')
@ApiBearerAuth()
@Roles(Role.student)
@Controller('practice')
export class PracticeController {
  constructor(private readonly practice: PracticeService) {}

  @Post('topic/:topicId/next')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get the next adaptive practice question for a topic (at the student’s level)' })
  next(@CurrentUser() user: AuthenticatedUser, @Param('topicId') topicId: string) {
    return this.practice.next(user.studentProfileId, topicId);
  }

  @Post('answer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Answer a practice question; a wrong answer is explained, not just failed' })
  answer(@CurrentUser() user: AuthenticatedUser, @Body() dto: AnswerDto) {
    return this.practice.answer(user.studentProfileId, dto);
  }
}
