import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DiagnosticService } from './diagnostic.service';
import { GenerateDiagnosticDto } from './dto/generate-diagnostic.dto';
import { SubmitDiagnosticDto } from './dto/submit-diagnostic.dto';

@ApiTags('diagnostics')
@ApiBearerAuth()
@Roles(Role.student)
@Controller('diagnostics')
export class DiagnosticController {
  constructor(private readonly diagnostics: DiagnosticService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a diagnostic test for a subject' })
  generate(@Body() dto: GenerateDiagnosticDto) {
    return this.diagnostics.generate(dto);
  }

  @Post(':testId/start')
  @ApiOperation({ summary: 'Start a diagnostic attempt (returns questions)' })
  start(@CurrentUser() user: AuthenticatedUser, @Param('testId') testId: string) {
    return this.diagnostics.start(user.studentProfileId, testId);
  }

  @Post('attempts/:attemptId/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit answers, score, and update the weakness profile' })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('attemptId') attemptId: string,
    @Body() dto: SubmitDiagnosticDto,
  ) {
    return this.diagnostics.submit(user.studentProfileId, attemptId, dto);
  }

  @Get('attempts/:attemptId')
  @ApiOperation({ summary: 'Get a diagnostic attempt with answers' })
  getAttempt(@CurrentUser() user: AuthenticatedUser, @Param('attemptId') attemptId: string) {
    return this.diagnostics.getAttempt(user.studentProfileId, attemptId);
  }
}
