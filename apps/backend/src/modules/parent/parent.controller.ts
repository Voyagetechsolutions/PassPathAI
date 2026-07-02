import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ParentService } from './parent.service';
import { LinkChildDto } from './dto/link-child.dto';

@ApiTags('parent')
@ApiBearerAuth()
@Roles(Role.parent)
@Controller('parent')
export class ParentController {
  constructor(private readonly parent: ParentService) {}

  @Post('children')
  @ApiOperation({ summary: 'Link a child by their account email' })
  link(@CurrentUser() user: AuthenticatedUser, @Body() dto: LinkChildDto) {
    return this.parent.linkChild(user.parentProfileId, dto);
  }

  @Get('children')
  @ApiOperation({ summary: 'List linked children' })
  children(@CurrentUser() user: AuthenticatedUser) {
    return this.parent.listChildren(user.parentProfileId);
  }

  @Get('children/:studentId/dashboard')
  @ApiOperation({ summary: 'View a child’s performance, consistency and weak subjects' })
  childDashboard(@CurrentUser() user: AuthenticatedUser, @Param('studentId') studentId: string) {
    return this.parent.getChildDashboard(user.parentProfileId, studentId);
  }
}
