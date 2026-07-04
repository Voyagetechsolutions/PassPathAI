import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user';
import type { AppConfig } from '../../config/configuration';

/**
 * Enforces @Roles(...) metadata. Runs after FirebaseAuthGuard, so request.user
 * is already populated. Routes with no @Roles() decorator are allowed for any
 * authenticated user.
 *
 * Emails listed in ADMIN_EMAILS satisfy an `admin` requirement without a DB
 * role change, so the founder's everyday student account can open the admin
 * dashboard while keeping all student endpoints working.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Insufficient role');
    }
    if (required.includes(user.role)) {
      return true;
    }
    const adminEmails = this.config.get('admin', { infer: true }).emails;
    if (required.includes(Role.admin) && adminEmails.includes(user.email.toLowerCase())) {
      return true;
    }
    throw new ForbiddenException('Insufficient role');
  }
}
