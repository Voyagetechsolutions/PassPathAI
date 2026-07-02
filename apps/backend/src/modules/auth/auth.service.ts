import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { FirebaseService, FirebaseTokenClaims } from '../../infra/firebase/firebase.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { AppConfig } from '../../config/configuration';
import { RegisterDto } from './dto/register.dto';

export interface DevLoginResult {
  token: string;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Dev-only password login for demo accounts. Returns a `dev:<userId>` bearer
   * token the guard accepts. Disabled entirely in production.
   */
  async devLogin(email: string, password: string): Promise<DevLoginResult> {
    const devAuth = this.config.get('devAuth', { infer: true });
    if (!devAuth.enabled) {
      throw new NotFoundException('Dev auth is disabled');
    }
    if (password !== devAuth.demoPassword) {
      throw new UnauthorizedException('Invalid demo credentials');
    }
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        studentProfile: { select: { id: true } },
        parentProfile: { select: { id: true } },
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid demo credentials');
    }
    return { token: `dev:${user.id}`, user: this.toAuthUser(user, true) };
  }

  /**
   * Provision the local account after a Firebase sign-up. Idempotency: a second
   * call with the same Firebase UID is rejected as a conflict.
   */
  async register(claims: FirebaseTokenClaims, dto: RegisterDto): Promise<AuthenticatedUser> {
    if (!claims.email) {
      throw new BadRequestException('Firebase token has no email');
    }
    const existing = await this.prisma.user.findUnique({ where: { firebaseUid: claims.uid } });
    if (existing) {
      throw new ConflictException('Account already registered');
    }
    if (dto.role === Role.student && (dto.grade === undefined || dto.grade === null)) {
      throw new BadRequestException('Grade is required for students');
    }
    // Admins cannot self-register through this endpoint.
    const role = dto.role === Role.admin ? Role.student : dto.role;

    const user = await this.prisma.user.create({
      data: {
        firebaseUid: claims.uid,
        email: claims.email,
        emailVerified: claims.emailVerified,
        role,
        ...(role === Role.student
          ? {
              studentProfile: {
                create: {
                  firstName: dto.firstName,
                  surname: dto.surname,
                  grade: dto.grade!,
                  school: dto.school,
                  province: dto.province,
                },
              },
            }
          : {
              parentProfile: {
                create: { firstName: dto.firstName, surname: dto.surname },
              },
            }),
      },
      include: {
        studentProfile: { select: { id: true } },
        parentProfile: { select: { id: true } },
      },
    });

    return this.toAuthUser(user, claims.emailVerified);
  }

  /**
   * Verify a raw Firebase ID token (used by the public register endpoint, where
   * no local account exists yet so the guard cannot run).
   */
  async verifyToken(token: string): Promise<FirebaseTokenClaims> {
    try {
      return await this.firebase.verifyIdToken(token);
    } catch {
      throw new BadRequestException('Invalid or expired Firebase token');
    }
  }

  /**
   * Record a login and return the current principal. Token already verified by
   * the guard; here we refresh emailVerified + lastLoginAt.
   */
  async recordSession(userId: string, emailVerified: boolean): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date(), emailVerified },
      include: {
        studentProfile: { select: { id: true } },
        parentProfile: { select: { id: true } },
      },
    });
    return this.toAuthUser(user, emailVerified);
  }

  /**
   * Logout-everywhere: revoke all Firebase refresh tokens for the user.
   */
  async logout(uid: string): Promise<void> {
    await this.firebase.revokeRefreshTokens(uid);
  }

  /**
   * Admin role management.
   */
  async setRole(targetUserId: string, role: Role): Promise<AuthenticatedUser> {
    const user = await this.prisma.user
      .update({
        where: { id: targetUserId },
        data: { role },
        include: {
          studentProfile: { select: { id: true } },
          parentProfile: { select: { id: true } },
        },
      })
      .catch(() => {
        throw new NotFoundException('User not found');
      });
    return this.toAuthUser(user, user.emailVerified);
  }

  private toAuthUser(
    user: {
      id: string;
      firebaseUid: string;
      email: string;
      role: Role;
      studentProfile: { id: string } | null;
      parentProfile: { id: string } | null;
    },
    emailVerified: boolean,
  ): AuthenticatedUser {
    return {
      id: user.id,
      uid: user.firebaseUid,
      email: user.email,
      role: user.role,
      emailVerified,
      studentProfileId: user.studentProfile?.id,
      parentProfileId: user.parentProfile?.id,
    };
  }
}
