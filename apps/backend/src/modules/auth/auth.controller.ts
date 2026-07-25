import {
  Body,
  Controller,
  Get,
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
import { LoginDto } from './dto/login.dto';

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
  @ApiOperation({ summary: 'Create an account in PostgreSQL and start a session' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @ApiOperation({ summary: 'Sign in with an email and password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
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
    return this.authService.recordSession(user.id);
  }

  @Get('me')
  @ApiOperation({ summary: 'Return the current authenticated principal' })
  me(@CurrentUser() user: AuthenticatedUser): AuthUserDto {
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke all refresh tokens (logout everywhere)' })
  logout(): void {
    // Access tokens are short-lived and discarded by the client.
  }

  @Patch('role')
  @Roles(Role.admin)
  @ApiOperation({ summary: 'Admin: assign a role to a user' })
  async setRole(@Body() dto: UpdateRoleDto): Promise<AuthUserDto> {
    return this.authService.setRole(dto.userId, dto.role);
  }
}
