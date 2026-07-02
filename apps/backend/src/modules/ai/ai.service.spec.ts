/* eslint-disable @typescript-eslint/no-explicit-any */
import { ServiceUnavailableException } from '@nestjs/common';
import { AiService } from './ai.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OpenAiService } from '../../infra/openai/openai.service';
import { OUT_OF_SCOPE_MESSAGE, REFUSAL_MESSAGE } from './prompts';

describe('AiService', () => {
  let service: AiService;
  let prisma: any;
  let openai: any;

  beforeEach(() => {
    prisma = {
      aiSetting: { findUnique: jest.fn().mockResolvedValue(null) }, // use fallbacks
      aiQuery: { create: jest.fn().mockResolvedValue({ id: 'q1' }) },
      subject: { findUnique: jest.fn().mockResolvedValue({ name: 'Life Sciences' }) },
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };
    openai = {
      isConfigured: true,
      embedOne: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      embed: jest.fn(),
      chat: jest.fn(),
    };
    service = new AiService(prisma as unknown as PrismaService, openai as unknown as OpenAiService);
  });

  it('answers from grounded context and records citations', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { id: 'c1', content: 'Factorising x²−9 gives (x−3)(x+3).', score: 0.92 },
    ]);
    openai.chat.mockResolvedValue({
      content: 'A difference of two squares factorises as (a−b)(a+b). [1]',
      model: 'gpt-4o-mini',
      promptTokens: 100,
      completionTokens: 20,
    });

    const result = await service.ask('sp1', {
      question: 'Factorise x²−9',
      subjectCode: 'MATH-G10',
    });

    expect(openai.chat).toHaveBeenCalledTimes(1);
    expect(result.answered).toBe(true);
    expect(result.grounded).toBe(true);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].chunkId).toBe('c1');
    expect(result.citations[0].score).toBeCloseTo(0.92);
  });

  it('teaches within grade/subject scope when no source matches (hybrid fallback)', async () => {
    // Retrieved chunk is below the similarity threshold → no grounded source.
    prisma.$queryRaw.mockResolvedValue([{ id: 'c1', content: 'irrelevant', score: 0.15 }]);
    openai.chat.mockResolvedValue({
      content: 'Photosynthesis is how plants convert sunlight, water and CO₂ into glucose.',
      model: 'gpt-4o-mini',
      promptTokens: 60,
      completionTokens: 40,
    });

    const result = await service.ask('sp1', {
      question: 'What is photosynthesis?',
      grade: 10,
      subjectCode: 'LIFE-G10',
    });

    expect(openai.chat).toHaveBeenCalledTimes(1); // teaching only (no grounded passages)
    expect(result.answered).toBe(true);
    expect(result.grounded).toBe(false);
    expect(result.citations).toHaveLength(0);
    expect(prisma.subject.findUnique).toHaveBeenCalledWith({ where: { code: 'LIFE-G10' } });
  });

  it('falls back to teaching when grounded context is insufficient', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'c1', content: 'some context', score: 0.8 }]);
    openai.chat
      .mockResolvedValueOnce({
        content: REFUSAL_MESSAGE, // grounded model could not answer from context
        model: 'gpt-4o-mini',
        promptTokens: 80,
        completionTokens: 10,
      })
      .mockResolvedValueOnce({
        content: 'Here is the concept explained step by step…',
        model: 'gpt-4o-mini',
        promptTokens: 50,
        completionTokens: 30,
      });

    const result = await service.ask('sp1', { question: 'Explain it', grade: 11 });

    expect(openai.chat).toHaveBeenCalledTimes(2);
    expect(result.answered).toBe(true);
    expect(result.grounded).toBe(false);
    expect(result.citations).toHaveLength(0);
  });

  it('declines non-academic questions in teaching mode', async () => {
    prisma.$queryRaw.mockResolvedValue([]); // nothing retrieved
    openai.chat.mockResolvedValue({
      content: OUT_OF_SCOPE_MESSAGE,
      model: 'gpt-4o-mini',
      promptTokens: 30,
      completionTokens: 12,
    });

    const result = await service.ask('sp1', { question: "what's your favourite colour" });

    expect(result.answered).toBe(false);
    expect(result.grounded).toBe(false);
    expect(result.citations).toHaveLength(0);
    const logged = prisma.aiQuery.create.mock.calls[0][0];
    expect(logged.data.answered).toBe(false);
  });

  it('throws when the AI service is not configured', async () => {
    openai.isConfigured = false;
    await expect(service.ask('sp1', { question: 'anything' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('backfills embeddings for chunks without vectors (one bulk update per batch)', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { id: 'c1', content: 'one' },
        { id: 'c2', content: 'two' },
      ])
      .mockResolvedValueOnce([]); // second pass: nothing left
    openai.embed.mockResolvedValue([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);

    const result = await service.backfillEmbeddings(50);

    expect(result.embedded).toBe(2);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1); // bulk: one statement for the batch
  });
});
