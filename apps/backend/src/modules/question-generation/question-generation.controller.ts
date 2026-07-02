import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { QuestionType, Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { QuestionGenerationService } from './question-generation.service';
import { GenerateQuestionsDto } from './dto/generate-questions.dto';

@ApiTags('questions')
@ApiBearerAuth()
@Controller('questions')
export class QuestionGenerationController {
  constructor(private readonly questions: QuestionGenerationService) {}

  @Post('generate')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Admin: generate grounded, curriculum-aligned questions for a topic' })
  generate(@Body() dto: GenerateQuestionsDto) {
    return this.questions.generate(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List questions (filter by topic, subject or type)' })
  @ApiQuery({ name: 'topicId', required: false })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: QuestionType })
  list(
    @Query('topicId') topicId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('type') type?: QuestionType,
  ) {
    return this.questions.list({ topicId, subjectId, type });
  }
}
