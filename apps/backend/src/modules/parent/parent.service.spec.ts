/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ParentService } from './parent.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';

describe('ParentService', () => {
  let service: ParentService;
  let prisma: any;
  let dashboard: { getDashboard: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      parentChild: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
      weakTopicProfile: { findMany: jest.fn().mockResolvedValue([]) },
      studyStreak: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    dashboard = { getDashboard: jest.fn().mockResolvedValue({ predictedScore: 60 }) };
    service = new ParentService(
      prisma as unknown as PrismaService,
      dashboard as unknown as DashboardService,
    );
  });

  it('rejects non-parents', async () => {
    await expect(service.listChildren(undefined)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('links a child by email', async () => {
    prisma.user.findUnique.mockResolvedValue({ studentProfile: { id: 'sp1' } });
    prisma.parentChild.findUnique.mockResolvedValue(null);
    prisma.parentChild.create.mockResolvedValue({ id: 'link1' });
    await service.linkChild('pp1', { studentEmail: 'child@example.com' });
    expect(prisma.parentChild.create).toHaveBeenCalledWith({
      data: { parentId: 'pp1', studentId: 'sp1' },
    });
  });

  it('rejects linking an unknown student', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.linkChild('pp1', { studentEmail: 'nope@example.com' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a duplicate link', async () => {
    prisma.user.findUnique.mockResolvedValue({ studentProfile: { id: 'sp1' } });
    prisma.parentChild.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(
      service.linkChild('pp1', { studentEmail: 'child@example.com' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to show an unlinked child’s dashboard', async () => {
    prisma.parentChild.findUnique.mockResolvedValue(null);
    await expect(service.getChildDashboard('pp1', 'sp-other')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns a linked child dashboard read-only', async () => {
    prisma.parentChild.findUnique.mockResolvedValue({ id: 'link1' });
    const result = await service.getChildDashboard('pp1', 'sp1');
    expect(result.performance.predictedScore).toBe(60);
    expect(dashboard.getDashboard).toHaveBeenCalledWith('sp1');
  });
});
