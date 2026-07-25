import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import type { AppConfig } from '../../config/configuration';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { hashPassword, verifyPassword } from './password';
import { TokenService } from './token.service';

export interface LoginResult { token: string; user: AuthenticatedUser }

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async register(dto: RegisterDto): Promise<LoginResult> {
    const email = dto.email.trim().toLowerCase();
    if (dto.role === Role.student && dto.grade == null) {
      throw new BadRequestException('Grade is required for students');
    }
    const exists = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) throw new ConflictException('An account with this email already exists');

    const role = dto.role === Role.admin ? Role.student : dto.role;
    const passwordHash = await hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        emailVerified: false,
        role,
        ...(role === Role.student
          ? { studentProfile: { create: {
              firstName: dto.firstName,
              surname: dto.surname,
              grade: dto.grade!,
              school: dto.school,
              province: dto.province,
            } } }
          : { parentProfile: { create: { firstName: dto.firstName, surname: dto.surname } } }),
      },
      include: this.profileInclude,
    });
    const principal = this.toAuthUser(user);
    return { token: this.tokens.sign(user.id), user: principal };
  }

  async login(emailInput: string, password: string): Promise<LoginResult> {
    const email = emailInput.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email }, include: this.profileInclude });
    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) throw new UnauthorizedException('Account is suspended');
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      include: this.profileInclude,
    });
    return { token: this.tokens.sign(user.id), user: this.toAuthUser(updated) };
  }

  async devLogin(email: string, password: string): Promise<LoginResult> {
    const devAuth = this.config.get('devAuth', { infer: true });
    if (!devAuth.enabled) throw new NotFoundException('Dev auth is disabled');
    if (password !== devAuth.demoPassword) throw new UnauthorizedException('Invalid demo credentials');
    const user = await this.prisma.user.findUnique({ where: { email }, include: this.profileInclude });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid demo credentials');
    return { token: this.tokens.sign(user.id), user: this.toAuthUser(user) };
  }

  async recordSession(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.update({
      where: { id: userId }, data: { lastLoginAt: new Date() }, include: this.profileInclude,
    });
    return this.toAuthUser(user);
  }

  async setRole(targetUserId: string, role: Role): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.update({
      where: { id: targetUserId }, data: { role }, include: this.profileInclude,
    }).catch(() => { throw new NotFoundException('User not found'); });
    return this.toAuthUser(user);
  }

  private readonly profileInclude = {
    studentProfile: { select: { id: true } },
    parentProfile: { select: { id: true } },
  } as const;

  private toAuthUser(user: {
    id: string; email: string; role: Role; emailVerified: boolean;
    studentProfile: { id: string } | null; parentProfile: { id: string } | null;
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      studentProfileId: user.studentProfile?.id,
      parentProfileId: user.parentProfile?.id,
    };
  }
}
