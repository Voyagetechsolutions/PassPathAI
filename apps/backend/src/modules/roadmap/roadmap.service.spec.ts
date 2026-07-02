/* eslint-disable @typescript-eslint/no-explicit-any */
import { MissionStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { RoadmapService } from './roadmap.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StreakService } from '../dashboard/streak.service';

describe('RoadmapService', () => {
  let service: RoadmapService;
  let prisma: any;
  let streak: { recordActivity: jest.Mock };

  beforeEach(() => {
    prisma = {
      studentProfile: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'sp1', grade: 10 }) },
      weakTopicProfile: { findMany: jest.fn().mockResolvedValue([]) },
      importantDate: { findMany: jest.fn().mockResolvedValue([]) },
      studentSubject: { findMany: jest.fn().mockResolvedValue([]) },
      topic: { findMany: jest.fn().mockResolvedValue([]) },
      studyPlan: {
        create: jest.fn().mockResolvedValue({ id: 'plan1' }),
        findFirst: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      weeklyPlan: { create: jest.fn().mockResolvedValue({ id: 'w1' }) },
      dailyMission: { createMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };
    streak = { recordActivity: jest.fn() };
    service = new RoadmapService(
      prisma as unknown as PrismaService,
      streak as unknown as StreakService,
    );
  });

  it('builds a plan prioritising weak topics', async () => {
    prisma.weakTopicProfile.findMany.mockResolvedValue([
      {
        topicId: 't1',
        weaknessScore: 0.8,
        topic: { id: 't1', title: 'Algebra', subjectId: 's1', importance: 0.9 },
      },
    ]);

    const result = await service.generate('sp1', { days: 7, dailyMissionCount: 2 });

    expect(prisma.studyPlan.create).toHaveBeenCalledTimes(1);
    expect(prisma.weeklyPlan.create).toHaveBeenCalledTimes(1); // ceil(7/7)
    const missionsArg = prisma.dailyMission.createMany.mock.calls[0][0];
    expect(missionsArg.data).toHaveLength(14); // 7 days * 2
    expect(result.topTopics[0].title).toBe('Algebra');
  });

  it('falls back to important topics when there are no weak topics', async () => {
    prisma.studentSubject.findMany.mockResolvedValue([{ subjectId: 's1' }]);
    prisma.topic.findMany.mockResolvedValue([
      { id: 't2', title: 'Geometry', subjectId: 's1', importance: 0.8 },
    ]);

    const result = await service.generate('sp1', { days: 3, dailyMissionCount: 1 });
    expect(result.missions).toBe(3);
    expect(result.topTopics[0].title).toBe('Geometry');
  });

  it('marks a mission complete and extends the streak', async () => {
    prisma.dailyMission.findUnique.mockResolvedValue({ id: 'm1', plan: { studentId: 'sp1' } });
    prisma.dailyMission.update.mockResolvedValue({ id: 'm1', status: MissionStatus.COMPLETED });

    await service.updateMission('sp1', 'm1', { status: MissionStatus.COMPLETED });
    expect(streak.recordActivity).toHaveBeenCalledWith('sp1');
  });

  it('rejects updating another student’s mission', async () => {
    prisma.dailyMission.findUnique.mockResolvedValue({ id: 'm1', plan: { studentId: 'other' } });
    await expect(
      service.updateMission('sp1', 'm1', { status: MissionStatus.SKIPPED }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
