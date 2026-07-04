import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import type { AppConfig } from '../../config/configuration';

describe('RolesGuard', () => {
  const adminEmails = ['founder@example.com'];

  function guardFor(required: Role[] | undefined) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(required) };
    const config = { get: jest.fn().mockReturnValue({ emails: adminEmails }) };
    return new RolesGuard(
      reflector as unknown as Reflector,
      config as unknown as ConfigService<AppConfig, true>,
    );
  }

  function contextWith(user?: { role: Role; email: string }) {
    return {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  it('allows a matching role', () => {
    const guard = guardFor([Role.student]);
    expect(guard.canActivate(contextWith({ role: Role.student, email: 'a@b.c' }))).toBe(true);
  });

  it('rejects a non-matching role', () => {
    const guard = guardFor([Role.admin]);
    expect(() => guard.canActivate(contextWith({ role: Role.student, email: 'a@b.c' }))).toThrow(
      ForbiddenException,
    );
  });

  it('elevates an allow-listed email to admin without a role change', () => {
    const guard = guardFor([Role.admin]);
    expect(
      guard.canActivate(contextWith({ role: Role.student, email: 'Founder@Example.com' })),
    ).toBe(true);
  });

  it('does not elevate allow-listed emails for non-admin role requirements', () => {
    const guard = guardFor([Role.parent]);
    expect(() =>
      guard.canActivate(contextWith({ role: Role.student, email: 'founder@example.com' })),
    ).toThrow(ForbiddenException);
  });
});
