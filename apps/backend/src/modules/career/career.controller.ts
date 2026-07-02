import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CareerService } from './career.service';
import { CreateCareerDto } from './dto/create-career.dto';
import { MatchCareersDto } from './dto/match-careers.dto';

@ApiTags('careers')
@ApiBearerAuth()
@Controller('careers')
export class CareerController {
  constructor(private readonly careers: CareerService) {}

  @Get()
  @ApiOperation({ summary: 'List careers in the database' })
  list() {
    return this.careers.listCareers();
  }

  @Get('recommended')
  @Roles(Role.student)
  @ApiOperation({ summary: 'Recommend careers from the student’s stored subjects + marks' })
  recommended(@CurrentUser() user: AuthenticatedUser) {
    return this.careers.recommended(user.studentProfileId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a career with programmes and requirements' })
  get(@Param('id') id: string) {
    return this.careers.getCareer(id);
  }

  @Post()
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Admin: add a career to the database' })
  create(@Body() dto: CreateCareerDto) {
    return this.careers.createCareer(dto);
  }

  @Post('match')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.student)
  @ApiOperation({ summary: 'Match careers from subjects + marks (APS, eligibility, likelihood)' })
  match(@CurrentUser() user: AuthenticatedUser, @Body() dto: MatchCareersDto) {
    return this.careers.match(user.studentProfileId, dto);
  }
}
