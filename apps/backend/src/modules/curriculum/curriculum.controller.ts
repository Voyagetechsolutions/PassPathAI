import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurriculumService, UploadedFile as UploadedFileType } from './curriculum.service';
import { ImportCurriculumDto } from './dto/import-curriculum.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateTopicDto } from './dto/create-topic.dto';
import { CreateSubtopicDto } from './dto/create-subtopic.dto';
import { RegisterDocumentDto } from './dto/register-document.dto';
import { IngestDocumentDto } from './dto/ingest-document.dto';

@ApiTags('curriculum')
@ApiBearerAuth()
@Controller('curriculum')
export class CurriculumController {
  constructor(private readonly curriculum: CurriculumService) {}

  // ─── Read (any authenticated user) ───────────────────────────────────────────

  @Get('subjects')
  @ApiOperation({ summary: 'List subjects, optionally filtered by grade' })
  @ApiQuery({ name: 'grade', required: false, example: 10 })
  listSubjects(@Query('grade') grade?: string) {
    const parsed = grade !== undefined ? Number(grade) : undefined;
    return this.curriculum.listSubjects(Number.isNaN(parsed) ? undefined : parsed);
  }

  @Get('subjects/:id')
  @ApiOperation({ summary: 'Get a subject with its full topic/subtopic tree' })
  getSubjectTree(@Param('id') id: string) {
    return this.curriculum.getSubjectTree(id);
  }

  // ─── Admin: management ────────────────────────────────────────────────────────

  @Post('subjects')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Admin: create a subject' })
  createSubject(@Body() dto: CreateSubjectDto) {
    return this.curriculum.createSubject(dto);
  }

  @Post('topics')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Admin: create a topic' })
  createTopic(@Body() dto: CreateTopicDto) {
    return this.curriculum.createTopic(dto);
  }

  @Post('subtopics')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Admin: create a subtopic' })
  createSubtopic(@Body() dto: CreateSubtopicDto) {
    return this.curriculum.createSubtopic(dto);
  }

  @Post('import')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Admin: bulk-import a structured curriculum' })
  import(@Body() dto: ImportCurriculumDto) {
    return this.curriculum.importCurriculum(dto);
  }

  // ─── Admin: document ingestion ───────────────────────────────────────────────

  @Post('documents')
  @Roles(Role.admin)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Admin: upload a CAPS/curriculum document (PDF or text)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title'],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        subjectCode: { type: 'string' },
        grade: { type: 'integer' },
      },
    },
  })
  registerDocument(
    @UploadedFile() file: UploadedFileType | undefined,
    @Body() dto: RegisterDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('A file is required');
    }
    return this.curriculum.registerDocument(file, dto);
  }

  @Post('documents/:id/ingest')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Admin: extract + chunk a document into the knowledge base' })
  ingest(@Param('id') id: string, @Body() dto: IngestDocumentDto) {
    return this.curriculum.ingestDocument(id, dto.sourceType);
  }
}
