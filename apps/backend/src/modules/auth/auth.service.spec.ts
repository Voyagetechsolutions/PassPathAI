import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { FirebaseService, FirebaseTokenClaims } from '../../infra/firebase/firebase.service';
import type { AppConfig } from '../../config/configuration';
import { RegisterDto } from './dto/register.dto';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock } };
  let firebase: { revokeRefreshTokens: jest.Mock; verifyIdToken: jest.Mock };
  let devAuth: { enabled: boolean; demoPassword: string };

  const claims: FirebaseTokenClaims = {
    uid: 'fb-uid-1',
    email: 'thabo@example.com',
    emailVerified: true,
  };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    firebase = { revokeRefreshTokens: jest.fn(), verifyIdToken: jest.fn() };
    devAuth = { enabled: true, demoPassword: 'passpath-demo' };
    const config = {
      get: jest.fn(() => devAuth),
    } as unknown as ConfigService<AppConfig, true>;
    service = new AuthService(
      prisma as unknown as PrismaService,
      firebase as unknown as FirebaseService,
      config,
    );
  });

  describe('devLogin', () => {
    const demoUser = {
      id: 'u-demo',
      firebaseUid: 'demo-student',
      email: 'student@demo.passpath.app',
      role: Role.student,
      isActive: true,
      studentProfile: { id: 'sp-demo' },
      parentProfile: null,
    };

    it('returns a dev token for valid demo credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(demoUser);
      const result = await service.devLogin('student@demo.passpath.app', 'passpath-demo');
      expect(result.token).toBe('dev:u-demo');
      expect(result.user.studentProfileId).toBe('sp-demo');
    });

    it('rejects a wrong password', async () => {
      await expect(service.devLogin('student@demo.passpath.app', 'wrong')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('is disabled when dev auth is off', async () => {
      devAuth.enabled = false;
      await expect(
        service.devLogin('student@demo.passpath.app', 'passpath-demo'),
      ).rejects.toThrow();
    });
  });

  describe('register', () => {
    const baseDto: RegisterDto = {
      role: Role.student,
      firstName: 'Thabo',
      surname: 'Mokoena',
      grade: 10,
    };

    it('creates a student account with profile', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u1',
        firebaseUid: claims.uid,
        email: claims.email,
        role: Role.student,
        studentProfile: { id: 'sp1' },
        parentProfile: null,
      });

      const result = await service.register(claims, baseDto);

      expect(result.studentProfileId).toBe('sp1');
      expect(result.role).toBe(Role.student);
      expect(prisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('rejects a duplicate registration', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.register(claims, baseDto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('requires a grade for students', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const dto = { ...baseDto, grade: undefined };
      await expect(service.register(claims, dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('downgrades an attempted admin self-registration to student', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u2',
        firebaseUid: claims.uid,
        email: claims.email,
        role: Role.student,
        studentProfile: { id: 'sp2' },
        parentProfile: null,
      });
      await service.register(claims, { ...baseDto, role: Role.admin });
      const createArg = prisma.user.create.mock.calls[0][0];
      expect(createArg.data.role).toBe(Role.student);
    });
  });

  describe('logout', () => {
    it('revokes refresh tokens', async () => {
      await service.logout('fb-uid-1');
      expect(firebase.revokeRefreshTokens).toHaveBeenCalledWith('fb-uid-1');
    });
  });
});
