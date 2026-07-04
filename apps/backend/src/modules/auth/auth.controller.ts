import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AuthUserDto } from './dto/auth-response.dto';
import { DevLoginDto } from './dto/dev-login.dto';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  // Abuse guard: at most 5 new accounts per IP per day. Generous enough for a
  // family or a study group on one connection; hostile enough for farm scripts.
  @Throttle({ default: { limit: 5, ttl: 86_400_000 } })
  @ApiOperation({ summary: 'Provision a local account after Firebase sign-up' })
  async register(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: RegisterDto,
  ): Promise<AuthUserDto> {
    const token = this.bearer(authorization);
    const claims = await this.authService.verifyToken(token);
    return this.authService.register(claims, dto);
  }

  @Public()
  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'DEV ONLY: password login for demo accounts (disabled in production)' })
  devLogin(@Body() dto: DevLoginDto) {
    return this.authService.devLogin(dto.email, dto.password);
  }

  @Post('session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a login and return the current principal' })
  async session(@CurrentUser() user: AuthenticatedUser): Promise<AuthUserDto> {
    return this.authService.recordSession(user.id, user.emailVerified);
  }

  @Get('me')
  @ApiOperation({ summary: 'Return the current authenticated principal' })
  me(@CurrentUser() user: AuthenticatedUser): AuthUserDto {
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke all refresh tokens (logout everywhere)' })
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.authService.logout(user.uid);
  }

  @Patch('role')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Admin: assign a role to a user' })
  async setRole(@Body() dto: UpdateRoleDto): Promise<AuthUserDto> {
    return this.authService.setRole(dto.userId, dto.role);
  }

  private bearer(authorization?: string): string {
    const [scheme, value] = (authorization ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) {
      throw new BadRequestException('Missing bearer token');
    }
    return value;
  }
}
