/* eslint-disable @typescript-eslint/no-explicit-any */
import { ForbiddenException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StreakService } from './streak.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: any;
  let streak: { getStreak: jest.Mock };

  beforeEach(() => {
    prisma = {
      topicMastery: { findMany: jest.fn().mockResolvedValue([]) },
      weakTopicProfile: { findMany: jest.fn().mockResolvedValue([]) },
      diagnosticAttempt: { findMany: jest.fn().mockResolvedValue([]) },
      examAttempt: { findMany: jest.fn().mockResolvedValue([]) },
      predictionSnapshot: { create: jest.fn(), findMany: jest.fn() },
    };
    streak = {
      getStreak: jest.fn().mockResolvedValue({
        currentStreak: 2,
        longestStreak: 5,
        lastActiveDate: null,
      }),
    };
    service = new DashboardService(
      prisma as unknown as PrismaService,
      streak as unknown as StreakService,
    );
  });

  it('rejects non-students', async () => {
    await expect(service.getDashboard(undefined)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('aggregates mastery, counts completed topics, and snapshots a prediction', async () => {
    prisma.topicMastery.findMany.mockResolvedValue([
      { masteryScore: 0.9 },
      { masteryScore: 0.5 },
      { masteryScore: 0.85 },
    ]);
    prisma.diagnosticAttempt.findMany.mockResolvedValue([{ scorePercent: 70 }]);

    const view = await service.getDashboard('sp1');

    // avg mastery = 0.75 → 75
    expect(view.masteryScore).toBeCloseTo(75, 1);
    // completed = mastery >= 0.8 → two topics
    expect(view.completedTopics).toBe(2);
    expect(view.totalTrackedTopics).toBe(3);
    expect(view.streak.currentStreak).toBe(2);
    expect(view.predictedScore).toBeGreaterThan(0);
    expect(view.predictionConfidence).toBeGreaterThan(0);
    // A read must not trigger a remote DB write.
    expect(prisma.predictionSnapshot.create).not.toHaveBeenCalled();
  });

  it('weights recent assessment results into the prediction', async () => {
    prisma.topicMastery.findMany.mockResolvedValue([{ masteryScore: 0.5 }]); // mastery=50
    prisma.examAttempt.findMany.mockResolvedValue([{ scorePercent: 90 }]); // recent=90

    const view = await service.getDashboard('sp1');
    // 50*0.4 + 90*0.6 = 74
    expect(view.predictedScore).toBeCloseTo(74, 1);
  });
});
