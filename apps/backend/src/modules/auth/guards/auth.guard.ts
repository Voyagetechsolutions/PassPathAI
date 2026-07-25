import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import type { AuthenticatedUser } from '../../../common/types/authenticated-user';
import { withDbRetry } from '../../../common/utils/db-retry';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { TokenService } from '../token.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) throw new UnauthorizedException('Missing bearer token');
    const claims = this.tokens.verify(token);
    const user = await withDbRetry(() => this.prisma.user.findUnique({
      where: { id: claims.sub },
      include: {
        studentProfile: { select: { id: true } },
        parentProfile: { select: { id: true } },
      },
    }));
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid session');
    request.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      studentProfileId: user.studentProfile?.id,
      parentProfileId: user.parentProfile?.id,
    };
    return true;
  }
}
