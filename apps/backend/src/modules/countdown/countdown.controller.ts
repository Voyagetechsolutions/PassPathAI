import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CountdownService } from './countdown.service';
import { CreateImportantDateDto } from './dto/create-important-date.dto';

@ApiTags('countdown')
@ApiBearerAuth()
@Controller('countdown')
export class CountdownController {
  constructor(private readonly countdown: CountdownService) {}

  @Get()
  @Roles(Role.student)
  @ApiOperation({ summary: 'Year-end and exam countdowns for the student’s grade' })
  forStudent(@CurrentUser() user: AuthenticatedUser) {
    return this.countdown.getForStudent(user.studentProfileId);
  }

  @Get('dates')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Admin: list all important dates' })
  listDates() {
    return this.countdown.listDates();
  }

  @Post('dates')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Admin: create an important date / exam' })
  createDate(@Body() dto: CreateImportantDateDto) {
    return this.countdown.createDate(dto);
  }
}
