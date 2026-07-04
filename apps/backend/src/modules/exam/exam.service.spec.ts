/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException } from '@nestjs/common';
import { QuestionType, TestStatus } from '@prisma/client';
import { ExamService } from './exam.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { WeaknessService } from '../weakness/weakness.service';
import { SubscriptionService } from '../subscription/subscription.service';

describe('ExamService', () => {
  let service: ExamService;
  let prisma: any;
  let weakness: { recordResults: jest.Mock; recordMistakes: jest.Mock };
  let subscription: { isPremium: jest.Mock };

  beforeEach(() => {
    prisma = {
      subject: { findUnique: jest.fn() },
      question: { findMany: jest.fn() },
      examPaper: { create: jest.fn(), findUnique: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      examAttempt: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      examResponse: { createMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    weakness = { recordResults: jest.fn(), recordMistakes: jest.fn() };
    // Premium in tests by default — these tests exercise marking/generation logic, not the paywall.
    subscription = { isPremium: jest.fn().mockResolvedValue(true) };
    // AI marker awards full marks (clamped to each question's max) for the test.
    const openai = { isConfigured: true, chatJson: jest.fn().mockResolvedValue({ marks: 99, feedback: 'Correct.' }) };
    const config = { get: jest.fn().mockReturnValue({ tutorMessages: 5, mockExams: 1 }) };
    service = new ExamService(
      prisma as unknown as PrismaService,
      weakness as unknown as WeaknessService,
      openai as unknown as import('../../infra/openai/openai.service').OpenAiService,
      subscription as unknown as SubscriptionService,
      config as unknown as import('@nestjs/config').ConfigService<
        import('../../config/configuration').AppConfig,
        true
      >,
    );
  });

  it('rejects generating an exam with no questions', async () => {
    prisma.subject.findUnique.mockResolvedValue({ id: 's1', grade: 10, name: 'Maths' });
    prisma.question.findMany.mockResolvedValue([]);
    await expect(service.generate('sp1', { subjectId: 's1' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks a mixed-section submission and reports the breakdown', async () => {
    prisma.examAttempt.findUnique.mockResolvedValue({
      id: 'a1',
      studentId: 'sp1',
      status: TestStatus.IN_PROGRESS,
      paper: {
        totalMarks: 5,
        sections: [
          {
            title: 'Section A: Multiple Choice',
            items: [
              {
                id: 'item1',
                marks: 2,
                question: {
                  id: 'q1',
                  topicId: 't1',
                  type: QuestionType.MULTIPLE_CHOICE,
                  modelAnswer: null,
                  topic: { id: 't1', title: 'Algebra' },
                  options: [
                    { label: 'A', isCorrect: true },
                    { label: 'B', isCorrect: false },
                  ],
                },
              },
            ],
          },
          {
            title: 'Section B: Short Answer',
            items: [
              {
                id: 'item2',
                marks: 3,
                question: {
                  id: 'q2',
                  topicId: 't2',
                  type: QuestionType.SHORT_ANSWER,
                  modelAnswer: 'photosynthesis',
                  topic: { id: 't2', title: 'Biology' },
                  options: [],
                },
              },
            ],
          },
        ],
      },
    });

    const result = await service.submit('sp1', 'a1', {
      responses: [
        { examItemId: 'item1', response: 'A' }, // correct → 2
        { examItemId: 'item2', response: 'Photosynthesis' }, // normalised match → 3
      ],
    });

    expect(result.marksAwarded).toBe(5);
    expect(result.totalMarks).toBe(5);
    expect(result.scorePercent).toBe(100);
    expect(result.sections).toHaveLength(2);
    expect(weakness.recordResults).toHaveBeenCalledWith(
      'sp1',
      expect.arrayContaining([
        { topicId: 't1', attempts: 1, correct: 1 },
        { topicId: 't2', attempts: 1, correct: 1 },
      ]),
      'exam',
    );
  });

  it('awards zero for wrong answers and records mistakes', async () => {
    prisma.examAttempt.findUnique.mockResolvedValue({
      id: 'a1',
      studentId: 'sp1',
      status: TestStatus.IN_PROGRESS,
      paper: {
        totalMarks: 2,
        sections: [
          {
            title: 'Section A: Multiple Choice',
            items: [
              {
                id: 'item1',
                marks: 2,
                question: {
                  id: 'q1',
                  topicId: 't1',
                  type: QuestionType.MULTIPLE_CHOICE,
                  modelAnswer: null,
                  topic: { id: 't1', title: 'Algebra' },
                  options: [
                    { label: 'A', isCorrect: true },
                    { label: 'B', isCorrect: false },
                  ],
                },
              },
            ],
          },
        ],
      },
    });

    const result = await service.submit('sp1', 'a1', {
      responses: [{ examItemId: 'item1', response: 'B' }],
    });

    expect(result.marksAwarded).toBe(0);
    expect(result.scorePercent).toBe(0);
    expect(weakness.recordMistakes).toHaveBeenCalledWith('sp1', [
      { questionId: 'q1', topicId: 't1' },
    ]);
  });
});
