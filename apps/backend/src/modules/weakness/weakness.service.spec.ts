/* eslint-disable @typescript-eslint/no-explicit-any */
import { WeaknessService } from './weakness.service';
import { PrismaService } from '../../infra/prisma/prisma.service';

describe('WeaknessService', () => {
  let service: WeaknessService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      topicMastery: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      weakTopicProfile: { upsert: jest.fn(), deleteMany: jest.fn() },
      mistakeLog: { upsert: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    service = new WeaknessService(prisma as unknown as PrismaService);
  });

  it('accumulates mastery across prior attempts', async () => {
    prisma.topicMastery.findMany.mockResolvedValue([{ topicId: 't1', attempts: 4, correct: 2 }]);
    await service.recordResults('sp1', [{ topicId: 't1', attempts: 2, correct: 2 }], 'diagnostic');

    const upsertArg = prisma.topicMastery.upsert.mock.calls[0][0];
    // 4+2 attempts, 2+2 correct → smoothed mastery 4/(6+2) = 0.5
    expect(upsertArg.update.attempts).toBe(6);
    expect(upsertArg.update.correct).toBe(4);
    expect(upsertArg.update.masteryScore).toBeCloseTo(0.5, 3);
  });

  it('flags a topic as weak when mastery is at/below the threshold', async () => {
    prisma.topicMastery.findMany.mockResolvedValue([]);
    await service.recordResults('sp1', [{ topicId: 't1', attempts: 4, correct: 1 }], 'diagnostic');
    // mastery 0.25 → weakness 0.75 ≥ 0.5
    expect(prisma.weakTopicProfile.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.weakTopicProfile.deleteMany).not.toHaveBeenCalled();
  });

  it('clears the weak flag once a topic is mastered', async () => {
    prisma.topicMastery.findMany.mockResolvedValue([]);
    await service.recordResults('sp1', [{ topicId: 't1', attempts: 4, correct: 4 }], 'diagnostic');
    // smoothed mastery 4/6 ≈ 0.67 → weakness 0.33 < 0.5
    expect(prisma.weakTopicProfile.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.weakTopicProfile.upsert).not.toHaveBeenCalled();
  });

  it('increments repeat-mistake counts', async () => {
    await service.recordMistakes('sp1', [{ questionId: 'q1', topicId: 't1' }]);
    const arg = prisma.mistakeLog.upsert.mock.calls[0][0];
    expect(arg.update.count).toEqual({ increment: 1 });
    expect(arg.create.questionId).toBe('q1');
  });
});
