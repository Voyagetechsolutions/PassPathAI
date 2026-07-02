/* eslint-disable @typescript-eslint/no-explicit-any */
import { StreakService } from './streak.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

describe('StreakService', () => {
  let service: StreakService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      studyStreak: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    service = new StreakService(prisma as unknown as PrismaService);
  });

  it('starts a streak when none exists', async () => {
    prisma.studyStreak.findUnique.mockResolvedValue(null);
    await service.recordActivity('sp1', new Date('2026-06-24T10:00:00Z'));
    expect(prisma.studyStreak.create).toHaveBeenCalled();
    const arg = prisma.studyStreak.create.mock.calls[0][0];
    expect(arg.data.currentStreak).toBe(1);
  });

  it('extends the streak on a consecutive day', async () => {
    prisma.studyStreak.findUnique.mockResolvedValue({
      currentStreak: 3,
      longestStreak: 3,
      lastActiveDate: new Date('2026-06-23T08:00:00Z'),
    });
    await service.recordActivity('sp1', new Date('2026-06-24T09:00:00Z'));
    const arg = prisma.studyStreak.update.mock.calls[0][0];
    expect(arg.data.currentStreak).toBe(4);
    expect(arg.data.longestStreak).toBe(4);
  });

  it('is idempotent for same-day activity', async () => {
    prisma.studyStreak.findUnique.mockResolvedValue({
      currentStreak: 3,
      longestStreak: 5,
      lastActiveDate: new Date('2026-06-24T01:00:00Z'),
    });
    await service.recordActivity('sp1', new Date('2026-06-24T20:00:00Z'));
    expect(prisma.studyStreak.update).not.toHaveBeenCalled();
  });

  it('resets after a gap but preserves the longest streak', async () => {
    prisma.studyStreak.findUnique.mockResolvedValue({
      currentStreak: 6,
      longestStreak: 6,
      lastActiveDate: new Date('2026-06-20T08:00:00Z'),
    });
    await service.recordActivity('sp1', new Date('2026-06-24T09:00:00Z'));
    const arg = prisma.studyStreak.update.mock.calls[0][0];
    expect(arg.data.currentStreak).toBe(1);
    expect(arg.data.longestStreak).toBe(6);
  });
});
