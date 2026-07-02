import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { FirebaseService } from '../../../infra/firebase/firebase.service';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import type { AppConfig } from '../../../config/configuration';
import { withDbRetry } from '../../../common/utils/db-retry';

/**
 * Verifies the `Authorization: Bearer <firebase-id-token>` header, then loads the
 * local User (with profile ids). Routes marked @Public() bypass this guard.
 *
 * When dev auth is enabled (non-production only), a `Bearer dev:<userId>` token
 * is also accepted — used by the demo accounts when no Firebase project exists.
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly firebase: FirebaseService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    // Dev-only demo tokens: "dev:<userId>".
    const devAuth = this.config.get('devAuth', { infer: true });
    if (devAuth.enabled && token.startsWith('dev:')) {
      return this.authorizeDevToken(request, token.slice(4));
    }

    let claims;
    try {
      claims = await this.firebase.verifyIdToken(token);
    } catch (err) {
      this.logger.debug(`Token verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await withDbRetry(() =>
      this.prisma.user.findUnique({
        where: { firebaseUid: claims.uid },
        include: {
          studentProfile: { select: { id: true } },
          parentProfile: { select: { id: true } },
        },
      }),
    );

    if (!user) {
      throw new UnauthorizedException('Account not registered. Complete registration first.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is suspended');
    }

    request.user = {
      id: user.id,
      uid: user.firebaseUid,
      email: user.email,
      role: user.role,
      emailVerified: claims.emailVerified,
      studentProfileId: user.studentProfile?.id,
      parentProfileId: user.parentProfile?.id,
    };
    return true;
  }

  /**
   * Authorize a dev demo token by loading the user directly by id.
   */
  private async authorizeDevToken(
    request: Request & { user?: AuthenticatedUser },
    userId: string,
  ): Promise<boolean> {
    const user = await withDbRetry(() =>
      this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          studentProfile: { select: { id: true } },
          parentProfile: { select: { id: true } },
        },
      }),
    );
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid demo session');
    }
    request.user = {
      id: user.id,
      uid: user.firebaseUid,
      email: user.email,
      role: user.role,
      emailVerified: true,
      studentProfileId: user.studentProfile?.id,
      parentProfileId: user.parentProfile?.id,
    };
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) {
      return undefined;
    }
    const [scheme, value] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
  }
}
