import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { TutorService } from './tutor.service';
import { TutorMessageDto } from './dto/tutor-message.dto';
import { TutorRateDto } from './dto/tutor-rate.dto';

@ApiTags('tutor')
@ApiBearerAuth()
@Roles(Role.student)
@Controller('tutor')
export class TutorController {
  constructor(private readonly tutor: TutorService) {}

  @Post('topic/:topicId/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start or resume the conversational lesson for a topic' })
  start(@CurrentUser() user: AuthenticatedUser, @Param('topicId') topicId: string) {
    return this.tutor.start(user.studentProfileId, topicId);
  }

  @Post('topic/:topicId/message')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message (or starter) and get the tutor’s next reply' })
  message(
    @CurrentUser() user: AuthenticatedUser,
    @Param('topicId') topicId: string,
    @Body() dto: TutorMessageDto,
  ) {
    return this.tutor.message(user.studentProfileId, topicId, dto);
  }

  @Post('topic/:topicId/rate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Student explains the topic back; tutor rates understanding out of 10' })
  rate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('topicId') topicId: string,
    @Body() dto: TutorRateDto,
  ) {
    return this.tutor.rate(user.studentProfileId, topicId, dto);
  }
}
