import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CalendarService } from './calendar.service';
import { CreateExamDateDto } from './dto/create-exam-date.dto';

@ApiTags('calendar')
@ApiBearerAuth()
@Roles(Role.student)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  @ApiOperation({ summary: 'What was learnt each day this month + the student’s exams' })
  @ApiQuery({ name: 'month', required: false, example: '2026-11' })
  month(@CurrentUser() user: AuthenticatedUser, @Query('month') month?: string) {
    return this.calendar.month(user.studentProfileId, month);
  }

  @Post('exams')
  @ApiOperation({ summary: 'Add an upcoming exam date' })
  addExam(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateExamDateDto) {
    return this.calendar.addExam(user.studentProfileId, dto);
  }

  @Delete('exams/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove an exam date the student added' })
  removeExam(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.calendar.removeExam(user.studentProfileId, id);
  }
}
