import type { Request } from 'express';
import type { Role } from '@prisma/client';

/**
 * The authenticated principal attached to the request by FirebaseAuthGuard.
 * `id` is the local User PK; `uid` is the Firebase UID.
 */
export interface AuthenticatedUser {
  id: string;
  uid: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  studentProfileId?: string;
  parentProfileId?: string;
}

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}
