/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { Difficulty, QuestionType } from '@prisma/client';
import { QuestionGenerationService } from './question-generation.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OpenAiService } from '../../infra/openai/openai.service';

describe('QuestionGenerationService', () => {
  let service: QuestionGenerationService;
  let prisma: any;
  let openai: any;

  const baseDto = {
    topicId: 't1',
    type: QuestionType.MULTIPLE_CHOICE,
    difficulty: Difficulty.EASY,
    count: 2,
  };

  beforeEach(() => {
    prisma = {
      topic: {
        findUnique: jest.fn().mockResolvedValue({
          id: 't1',
          title: 'Algebra',
          subjectId: 's1',
          subject: { code: 'MATH-G10' },
        }),
      },
      knowledgeChunk: { findMany: jest.fn() },
      question: { create: jest.fn(), findMany: jest.fn() },
    };
    openai = { isConfigured: true, chatJson: jest.fn() };
    service = new QuestionGenerationService(
      prisma as unknown as PrismaService,
      openai as unknown as OpenAiService,
    );
  });

  it('refuses to generate when there is no curriculum source', async () => {
    prisma.knowledgeChunk.findMany.mockResolvedValue([]);
    await expect(service.generate(baseDto)).rejects.toBeInstanceOf(BadRequestException);
    expect(openai.chatJson).not.toHaveBeenCalled();
  });

  it('throws when AI is not configured', async () => {
    openai.isConfigured = false;
    await expect(service.generate(baseDto)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('persists valid grounded MCQs with labelled options', async () => {
    prisma.knowledgeChunk.findMany.mockResolvedValue([{ id: 'c1', content: 'x²−9=(x−3)(x+3)' }]);
    openai.chatJson.mockResolvedValue({
      questions: [
        {
          prompt: 'Factorise x²−9',
          marks: 1,
          options: [
            { text: '(x−3)(x+3)', isCorrect: true },
            { text: '(x−9)(x+1)', isCorrect: false },
            { text: '(x−3)²', isCorrect: false },
            { text: 'x(x−9)', isCorrect: false },
          ],
        },
      ],
    });
    prisma.question.create.mockResolvedValue({ id: 'q1', options: [] });

    const result = await service.generate(baseDto);

    expect(result.generated).toBe(1);
    const createArg = prisma.question.create.mock.calls[0][0];
    expect(createArg.data.aiGenerated).toBe(true);
    expect(createArg.data.sourceChunkId).toBe('c1');
    expect(createArg.data.options.create[0].label).toBe('A');
  });

  it('grounds on topic-relevant chunks via vector retrieval when embeddings exist', async () => {
    openai.embedOne = jest.fn().mockResolvedValue([0.1, 0.2, 0.3]);
    prisma.$queryRaw = jest.fn().mockResolvedValue([{ id: 'vec1', content: 'mitosis has 4 phases' }]);
    openai.chatJson.mockResolvedValue({
      questions: [
        {
          prompt: 'How many phases does mitosis have?',
          options: [
            { text: 'Four', isCorrect: true },
            { text: 'Two', isCorrect: false },
            { text: 'Six', isCorrect: false },
            { text: 'One', isCorrect: false },
          ],
        },
      ],
    });
    prisma.question.create.mockResolvedValue({ id: 'q1', options: [] });

    const result = await service.generate(baseDto);

    expect(openai.embedOne).toHaveBeenCalled();
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.knowledgeChunk.findMany).not.toHaveBeenCalled(); // vector path used, no fallback
    expect(result.generated).toBe(1);
    expect(prisma.question.create.mock.calls[0][0].data.sourceChunkId).toBe('vec1');
  });

  it('rejects MCQs that do not have exactly one correct option', async () => {
    prisma.knowledgeChunk.findMany.mockResolvedValue([{ id: 'c1', content: 'context' }]);
    openai.chatJson.mockResolvedValue({
      questions: [
        {
          prompt: 'Bad question',
          options: [
            { text: 'a', isCorrect: true },
            { text: 'b', isCorrect: true },
          ],
        },
      ],
    });
    await expect(service.generate(baseDto)).rejects.toBeInstanceOf(BadRequestException);
  });
});
