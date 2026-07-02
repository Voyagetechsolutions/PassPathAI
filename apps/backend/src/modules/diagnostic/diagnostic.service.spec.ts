/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { QuestionType, TestStatus } from '@prisma/client';
import { DiagnosticService } from './diagnostic.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { WeaknessService } from '../weakness/weakness.service';

describe('DiagnosticService', () => {
  let service: DiagnosticService;
  let prisma: any;
  let weakness: { recordResults: jest.Mock; recordMistakes: jest.Mock };

  const studentId = 'sp1';

  beforeEach(() => {
    prisma = {
      subject: { findUnique: jest.fn() },
      question: { findMany: jest.fn() },
      diagnosticTest: { create: jest.fn(), findUnique: jest.fn() },
      diagnosticAttempt: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      diagnosticAnswer: { createMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    weakness = { recordResults: jest.fn(), recordMistakes: jest.fn() };
    const roadmap = { recordTopicCompletion: jest.fn() };
    service = new DiagnosticService(
      prisma as unknown as PrismaService,
      weakness as unknown as WeaknessService,
      roadmap as unknown as import('../roadmap/roadmap.service').RoadmapService,
    );
  });

  describe('generate', () => {
    it('rejects subjects with no MCQ questions', async () => {
      prisma.subject.findUnique.mockResolvedValue({ id: 's1', grade: 10, name: 'Maths' });
      prisma.question.findMany.mockResolvedValue([]);
      await expect(service.generate({ subjectId: 's1' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('samples up to the requested count and persists a test', async () => {
      prisma.subject.findUnique.mockResolvedValue({ id: 's1', grade: 10, name: 'Maths' });
      prisma.question.findMany.mockResolvedValue([
        { id: 'q1', topicId: 't1' },
        { id: 'q2', topicId: 't1' },
        { id: 'q3', topicId: 't2' },
      ]);
      prisma.diagnosticTest.create.mockResolvedValue({
        id: 'test1',
        title: 'x',
        grade: 10,
        subjectId: 's1',
      });
      const result = await service.generate({ subjectId: 's1', questionCount: 2 });
      expect(result.questionCount).toBe(2);
      const createArg = prisma.diagnosticTest.create.mock.calls[0][0];
      expect(createArg.data.items.create).toHaveLength(2);
    });
  });

  describe('submit', () => {
    const attemptWithItems = {
      id: 'a1',
      studentId,
      status: TestStatus.IN_PROGRESS,
      test: {
        items: [
          {
            question: {
              id: 'q1',
              topicId: 't1',
              type: QuestionType.MULTIPLE_CHOICE,
              topic: { id: 't1', title: 'Algebra' },
              options: [
                { label: 'A', isCorrect: true },
                { label: 'B', isCorrect: false },
              ],
            },
          },
          {
            question: {
              id: 'q2',
              topicId: 't1',
              type: QuestionType.MULTIPLE_CHOICE,
              topic: { id: 't1', title: 'Algebra' },
              options: [
                { label: 'A', isCorrect: false },
                { label: 'B', isCorrect: true },
              ],
            },
          },
        ],
      },
    };

    it('scores answers and updates the weakness profile', async () => {
      prisma.diagnosticAttempt.findUnique.mockResolvedValue(attemptWithItems);

      const result = await service.submit(studentId, 'a1', {
        answers: [
          { questionId: 'q1', response: 'A' }, // correct
          { questionId: 'q2', response: 'A' }, // wrong
        ],
      });

      expect(result.total).toBe(2);
      expect(result.correctCount).toBe(1);
      expect(result.scorePercent).toBe(50);
      expect(result.topics[0]).toMatchObject({ topicId: 't1', total: 2, correct: 1 });
      expect(weakness.recordResults).toHaveBeenCalledWith(
        studentId,
        [{ topicId: 't1', attempts: 2, correct: 1 }],
        'diagnostic',
      );
      expect(weakness.recordMistakes).toHaveBeenCalledWith(studentId, [
        { questionId: 'q2', topicId: 't1' },
      ]);
    });

    it('rejects submitting another student’s attempt', async () => {
      prisma.diagnosticAttempt.findUnique.mockResolvedValue({
        ...attemptWithItems,
        studentId: 'someone-else',
      });
      await expect(
        service.submit(studentId, 'a1', { answers: [{ questionId: 'q1', response: 'A' }] }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects re-submitting a graded attempt', async () => {
      prisma.diagnosticAttempt.findUnique.mockResolvedValue({
        ...attemptWithItems,
        status: TestStatus.GRADED,
      });
      await expect(
        service.submit(studentId, 'a1', { answers: [{ questionId: 'q1', response: 'A' }] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
