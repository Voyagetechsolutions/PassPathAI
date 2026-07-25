import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CheckInDto } from './dto/check-in.dto';
import { FriendRequestDto } from './dto/friend-request.dto';
import { MessageDto } from './dto/message.dto';
import { SocialService } from './social.service';

@Controller('social')
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) { return this.social.summary(user); }

  @Post('friends')
  request(@CurrentUser() user: AuthenticatedUser, @Body() dto: FriendRequestDto) {
    return this.social.requestFriend(user, dto.email);
  }

  @Patch('friends/:id/accept')
  accept(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.social.acceptFriend(user, id);
  }

  @Get('friends/:id/messages')
  messages(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Query('after') after?: string) {
    return this.social.messages(user, id, after);
  }

  @Post('friends/:id/messages')
  send(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: MessageDto) {
    return this.social.sendMessage(user, id, dto.content);
  }

  @Post('check-in')
  checkIn(@CurrentUser() user: AuthenticatedUser, @Body() dto: CheckInDto) {
    return this.social.checkIn(user, dto.minutes ?? 1);
  }
}
