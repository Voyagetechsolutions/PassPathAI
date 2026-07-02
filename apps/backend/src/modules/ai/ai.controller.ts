import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AiService } from './ai.service';
import { AskDto } from './dto/ask.dto';
import { LessonDto } from './dto/lesson.dto';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.student)
  @ApiOperation({
    summary:
      'Ask a curriculum question. Answers from ingested CAPS sources when available (grounded), otherwise teaches within the grade/subject scope.',
  })
  ask(@CurrentUser() user: AuthenticatedUser, @Body() dto: AskDto) {
    return this.ai.ask(user.studentProfileId, dto);
  }

  @Post('lesson')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.student)
  @ApiOperation({ summary: 'Teach a topic as a syllabus-guided mini-lesson' })
  lesson(@Body() dto: LessonDto) {
    return this.ai.lesson(dto);
  }

  @Post('embeddings/backfill')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Admin: embed all knowledge chunks that have no vector yet' })
  backfill() {
    return this.ai.backfillEmbeddings();
  }
}
