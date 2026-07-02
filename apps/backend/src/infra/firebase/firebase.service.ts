import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as admin from 'firebase-admin';
import type { AppConfig } from '../../config/configuration';

export interface FirebaseTokenClaims {
  uid: string;
  email?: string;
  emailVerified: boolean;
}

/**
 * Wraps firebase-admin. Firebase is the identity provider: it owns passwords,
 * email verification and password reset. The backend only verifies ID tokens.
 */
@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app?: admin.app.App;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  onModuleInit(): void {
    if (admin.apps.length > 0) {
      this.app = admin.apps[0] ?? undefined;
      return;
    }
    const fb = this.config.get('firebase', { infer: true });

    let credential: admin.credential.Credential | undefined;
    if (fb.serviceAccountPath && fs.existsSync(fb.serviceAccountPath)) {
      const json = JSON.parse(fs.readFileSync(fb.serviceAccountPath, 'utf8'));
      credential = admin.credential.cert(json);
    } else if (fb.projectId && fb.clientEmail && fb.privateKey) {
      credential = admin.credential.cert({
        projectId: fb.projectId,
        clientEmail: fb.clientEmail,
        privateKey: fb.privateKey,
      });
    }

    if (!credential) {
      this.logger.warn(
        'Firebase credentials not configured — token verification will fail until set.',
      );
      return;
    }

    this.app = admin.initializeApp({ credential });
    this.logger.log('Firebase Admin initialised');
  }

  /**
   * Verify a Firebase ID token. Throws if invalid/expired.
   */
  async verifyIdToken(idToken: string): Promise<FirebaseTokenClaims> {
    if (!this.app) {
      throw new Error('Firebase is not configured');
    }
    const decoded = await this.app.auth().verifyIdToken(idToken, true);
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified ?? false,
    };
  }

  /**
   * Revoke all refresh tokens for a user (logout-everywhere / suspend).
   */
  async revokeRefreshTokens(uid: string): Promise<void> {
    if (!this.app) {
      throw new Error('Firebase is not configured');
    }
    await this.app.auth().revokeRefreshTokens(uid);
  }
}
