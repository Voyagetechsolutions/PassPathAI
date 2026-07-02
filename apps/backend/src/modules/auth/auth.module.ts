import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';

/**
 * Module 1 — Authentication. Firebase is the IdP; this module owns local account
 * provisioning and RBAC. FirebaseAuthGuard is exported for use as a global guard.
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService, FirebaseAuthGuard],
  exports: [AuthService, FirebaseAuthGuard],
})
export class AuthModule {}
