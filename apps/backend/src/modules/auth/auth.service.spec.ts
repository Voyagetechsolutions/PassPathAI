import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuthService } from './auth.service';
import { hashPassword } from './password';
import { TokenService } from './token.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock } };
  const tokens = { sign: jest.fn((id: string) => `token:${id}`) };
  const baseDto = {
    email: 'thabo@example.com', password: 'strong-password', role: Role.student,
    firstName: 'Thabo', surname: 'Mokoena', grade: 10,
  };

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } };
    const config: ConfigService<AppConfig, true> = {
      get: jest.fn(() => ({ enabled: true, demoPassword: 'passpath-demo' })),
    } as never;
    service = new AuthService(prisma as unknown as PrismaService, tokens as unknown as TokenService, config);
  });

  it('creates a student account and returns a signed session', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u1', email: baseDto.email, emailVerified: false, role: Role.student,
      studentProfile: { id: 'sp1' }, parentProfile: null,
    });
    const result = await service.register(baseDto);
    expect(result.token).toBe('token:u1');
    expect(result.user.studentProfileId).toBe('sp1');
    expect(prisma.user.create.mock.calls[0][0].data.passwordHash).toMatch(/^scrypt:/);
  });

  it('rejects duplicate registration', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.register(baseDto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires a grade for students', async () => {
    await expect(service.register({ ...baseDto, grade: undefined })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('logs in with a valid password', async () => {
    const user = {
      id: 'u1', email: baseDto.email, passwordHash: await hashPassword(baseDto.password), isActive: true,
      emailVerified: false, role: Role.student, studentProfile: { id: 'sp1' }, parentProfile: null,
    };
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);
    await expect(service.login(baseDto.email, baseDto.password)).resolves.toMatchObject({ token: 'token:u1' });
  });

  it('rejects an invalid password', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.login(baseDto.email, 'wrong')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
