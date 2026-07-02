import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Difficulty, Prisma, QuestionType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OpenAiService } from '../../infra/openai/openai.service';
import { GenerateQuestionsDto } from './dto/generate-questions.dto';

interface GeneratedOption {
  text: string;
  isCorrect: boolean;
}
interface GeneratedQuestion {
  prompt: string;
  marks?: number;
  options?: GeneratedOption[];
  modelAnswer?: string;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Module 6 — Question Generation. Generates curriculum-aligned questions GROUNDED
 * in the knowledge base: it retrieves the topic's curriculum chunks and instructs
 * the model to use only that context. No curriculum source → no generation.
 */
@Injectable()
export class QuestionGenerationService {
  private readonly logger = new Logger(QuestionGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiService,
  ) {}

  async generate(dto: GenerateQuestionsDto) {
    if (!this.openai.isConfigured) {
      throw new ServiceUnavailableException('AI service is not configured');
    }
    const count = dto.count ?? 5;

    const topic = await this.prisma.topic.findUnique({
      where: { id: dto.topicId },
      include: { subject: true },
    });
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    // Grounding: retrieve the chunks most relevant to this topic.
    const chunks = await this.retrieveTopicChunks(topic.subject.code, topic.subject.name, topic.title);
    if (chunks.length === 0) {
      throw new BadRequestException(
        'No curriculum source available for this topic — ingest material before generating.',
      );
    }

    const context = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n');
    const { system, user } = this.buildPrompt(
      dto.type,
      dto.difficulty,
      count,
      topic.title,
      context,
    );

    const parsed = await this.openai.chatJson<{ questions?: GeneratedQuestion[] }>(system, user);
    const valid = (parsed.questions ?? []).filter((q) => this.isValid(q, dto.type));
    if (valid.length === 0) {
      throw new BadRequestException('The model did not return valid grounded questions');
    }

    const sourceChunkId = chunks[0].id;
    const created = [];
    for (const q of valid.slice(0, count)) {
      const question = await this.prisma.question.create({
        data: {
          subjectId: topic.subjectId,
          topicId: topic.id,
          type: dto.type,
          difficulty: dto.difficulty,
          prompt: q.prompt,
          modelAnswer: dto.type === QuestionType.MULTIPLE_CHOICE ? undefined : q.modelAnswer,
          marks: q.marks && q.marks > 0 ? q.marks : 1,
          aiGenerated: true,
          sourceChunkId,
          options:
            dto.type === QuestionType.MULTIPLE_CHOICE && q.options
              ? {
                  create: q.options.map((o, i) => ({
                    label: OPTION_LABELS[i],
                    text: o.text,
                    isCorrect: o.isCorrect,
                  })),
                }
              : undefined,
        },
        include: { options: { select: { label: true, text: true, isCorrect: true } } },
      });
      created.push(question);
    }

    this.logger.log(`Generated ${created.length} ${dto.type} questions for topic ${topic.id}`);
    return { generated: created.length, questions: created };
  }

  async list(filters: { topicId?: string; subjectId?: string; type?: QuestionType }) {
    return this.prisma.question.findMany({
      where: {
        topicId: filters.topicId,
        subjectId: filters.subjectId,
        type: filters.type,
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: { options: { select: { label: true, text: true } } },
    });
  }

  /**
   * Retrieve the curriculum chunks most relevant to a topic. Uses vector
   * similarity against the topic title (so questions are about THIS topic, not
   * whatever chunk happens to come first); falls back to a plain subject lookup
   * if embeddings or the AI service are unavailable.
   */
  private async retrieveTopicChunks(
    subjectCode: string,
    subjectName: string | undefined,
    topicTitle: string,
  ): Promise<Array<{ id: string; content: string }>> {
    try {
      const vector = await this.openai.embedOne(`${subjectName ?? ''} ${topicTitle}`.trim());
      const literal = `[${vector.join(',')}]`;
      const rows = await this.prisma.$queryRaw<Array<{ id: string; content: string }>>(Prisma.sql`
        SELECT id, content FROM knowledge_chunks
        WHERE embedding IS NOT NULL AND subject_code = ${subjectCode}
        ORDER BY embedding <=> ${literal}::vector
        LIMIT 6
      `);
      if (rows.length > 0) {
        return rows;
      }
    } catch (e) {
      this.logger.warn(`Vector retrieval failed, falling back to subject lookup: ${(e as Error).message}`);
    }
    return this.prisma.knowledgeChunk.findMany({
      where: {
        subjectCode,
        OR: [{ topicTitle: { contains: topicTitle, mode: 'insensitive' } }, { topicTitle: null }],
      },
      take: 6,
      select: { id: true, content: true },
    });
  }

  // ─── prompt + validation ──────────────────────────────────────────────────────

  private buildPrompt(
    type: QuestionType,
    difficulty: Difficulty,
    count: number,
    topicTitle: string,
    context: string,
  ): { system: string; user: string } {
    const shape =
      type === QuestionType.MULTIPLE_CHOICE
        ? `Each question: { "prompt": string, "marks": number, "options": [{ "text": string, "isCorrect": boolean }] } with exactly 4 options and exactly one correct.`
        : `Each question: { "prompt": string, "marks": number, "modelAnswer": string } where modelAnswer is the marking memo.`;

    const system = `You are a CAPS-aligned exam author for South African high-school students.
STRICT RULES:
1. Use ONLY the provided CONTEXT. Do not introduce facts, formulas or examples not present in it.
2. If the CONTEXT is insufficient, return {"questions": []}.
3. Produce ${difficulty.toLowerCase()} difficulty questions on "${topicTitle}".
4. Write SELF-CONTAINED questions. The student never sees the CONTEXT, so NEVER refer to "the context", "the passage", "the text", "discussed/mentioned above", or similar. Phrase each question as a standalone exam question.
5. Return a single JSON object: { "questions": [ ... ] }. ${shape}`;

    const user = `CONTEXT:\n${context}\n\nGenerate ${count} ${difficulty.toLowerCase()} ${type} questions grounded only in the CONTEXT.`;
    return { system, user };
  }

  private isValid(q: GeneratedQuestion, type: QuestionType): boolean {
    if (!q.prompt || typeof q.prompt !== 'string') {
      return false;
    }
    if (type === QuestionType.MULTIPLE_CHOICE) {
      const options = q.options ?? [];
      const correct = options.filter((o) => o.isCorrect).length;
      return options.length >= 2 && options.length <= OPTION_LABELS.length && correct === 1;
    }
    return typeof q.modelAnswer === 'string' && q.modelAnswer.length > 0;
  }
}
