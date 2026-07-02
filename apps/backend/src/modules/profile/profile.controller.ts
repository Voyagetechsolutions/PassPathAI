import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetSubjectsDto } from './dto/set-subjects.dto';
import { OnboardingDto, SetMarksDto } from './dto/onboarding.dto';

@ApiTags('profile')
@ApiBearerAuth()
@Roles(Role.student)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current student profile with subjects' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getMyProfile(user);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current student profile' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateMyProfile(user, dto);
  }

  @Put('me/subjects')
  @ApiOperation({ summary: 'Replace the student subject enrolment' })
  setSubjects(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetSubjectsDto) {
    return this.profileService.setSubjects(user, dto);
  }

  @Post('onboarding')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete first-run onboarding (grade, syllabus, subjects + marks)' })
  onboarding(@CurrentUser() user: AuthenticatedUser, @Body() dto: OnboardingDto) {
    return this.profileService.completeOnboarding(user, dto);
  }

  @Get('marks')
  @ApiOperation({ summary: 'Get the student’s subjects and marks' })
  getMarks(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getMarks(user);
  }

  @Put('marks')
  @ApiOperation({ summary: 'Replace the student’s subjects and marks' })
  setMarks(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetMarksDto) {
    return this.profileService.setMarks(user, dto);
  }
}
