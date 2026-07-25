import type { Request } from 'express';
import type { Role } from '@prisma/client';

/**
 * The authenticated principal attached to the request by AuthGuard.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  studentProfileId?: string;
  parentProfileId?: string;
}

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}
