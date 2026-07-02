import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
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
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PastPapersService, UploadedFile as UploadedFileType } from './past-papers.service';
import { UploadPastPaperDto } from './dto/upload-past-paper.dto';

@ApiTags('past-papers')
@Controller('past-papers')
export class PastPapersController {
  constructor(private readonly papers: PastPapersService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List past papers (filter by grade, subject, or mine=true for the student’s subjects)' })
  @ApiQuery({ name: 'grade', required: false })
  @ApiQuery({ name: 'subjectId', required: false })
  @ApiQuery({ name: 'mine', required: false, description: 'true = only the student’s subjects' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('grade') grade?: string,
    @Query('subjectId') subjectId?: string,
    @Query('mine') mine?: string,
  ) {
    const g = grade !== undefined ? Number(grade) : undefined;
    return this.papers.list({
      grade: Number.isNaN(g) ? undefined : g,
      subjectId,
      studentId: mine === 'true' ? user.studentProfileId : undefined,
    });
  }

  @Post()
  @ApiBearerAuth()
  @Roles(Role.admin)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Admin: upload a past paper or memo' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'title', 'grade', 'year', 'kind'],
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        subjectId: { type: 'string' },
        grade: { type: 'integer' },
        year: { type: 'integer' },
        kind: { type: 'string' },
      },
    },
  })
  upload(@UploadedFile() file: UploadedFileType | undefined, @Body() dto: UploadPastPaperDto) {
    if (!file) {
      throw new BadRequestException('A file is required');
    }
    return this.papers.upload(file, dto);
  }

  @Public()
  @Get(':id/file')
  @ApiOperation({ summary: 'Download a past paper file' })
  async file(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const { buffer, mimeType, filename } = await this.papers.getFile(id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  }
}
