import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OpenAiService } from '../../infra/openai/openai.service';
import { AskDto } from './dto/ask.dto';
import { LessonDto } from './dto/lesson.dto';
import {
  buildLessonSystemPrompt,
  buildTeachingSystemPrompt,
  buildUserMessage,
  GROUNDED_SYSTEM_PROMPT,
  OUT_OF_SCOPE_MESSAGE,
  REFUSAL_MESSAGE,
} from './prompts';

export interface LessonResult {
  topicId: string;
  topicTitle: string;
  subjectName: string;
  grounded: boolean;
  introduction: string;
  sections: Array<{ heading: string; content: string }>;
  workedExample: string;
  keyTakeaways: string[];
}

export interface AskResult {
  answered: boolean;
  /** true → answer cites ingested CAPS sources; false → taught from CAPS knowledge. */
  grounded: boolean;
  answer: string;
  citations: Array<{ chunkId: string; score: number; preview: string }>;
}

interface RetrievedChunk {
  id: string;
  content: string;
  score: number;
}

/**
 * Module 5 — AI Learning Engine. Grounded RAG pipeline:
 *   question → embed → vector retrieval → grounding check → answer → validate.
 * If retrieval finds no sufficiently similar curriculum chunk, the engine refuses
 * ("no source → no answer") and never calls the model.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiService,
  ) {}

  // ─── Settings (DB-backed, admin-editable in Module 14) ───────────────────────

  private async getSetting(key: string, fallback: string): Promise<string> {
    const row = await this.prisma.aiSetting.findUnique({ where: { key } });
    return row?.value ?? fallback;
  }

  private async retrievalParams(): Promise<{ topK: number; minSimilarity: number }> {
    // 0.3 suits text-embedding-3-small, whose relevant-match cosine scores sit
    // around 0.4–0.65; 0.75 was far too strict and refused on-topic questions.
    const [topK, minSimilarity] = await Promise.all([
      this.getSetting('retrieval_top_k', '5'),
      this.getSetting('min_similarity', '0.3'),
    ]);
    return { topK: parseInt(topK, 10) || 5, minSimilarity: parseFloat(minSimilarity) || 0.3 };
  }

  // ─── Embedding backfill ──────────────────────────────────────────────────────

  /**
   * Embed every KnowledgeChunk that has no vector yet (e.g. created by ingestion).
   * Processes in batches; returns the number of chunks embedded.
   */
  async backfillEmbeddings(batchSize = 50): Promise<{ embedded: number }> {
    if (!this.openai.isConfigured) {
      throw new ServiceUnavailableException('AI service is not configured');
    }
    let total = 0;
    // Safeguard against unexpected loops.
    for (let iteration = 0; iteration < 10_000; iteration += 1) {
      const pending = await this.prisma.$queryRaw<Array<{ id: string; content: string }>>(
        Prisma.sql`SELECT id, content FROM knowledge_chunks WHERE embedding IS NULL LIMIT ${batchSize}`,
      );
      if (pending.length === 0) {
        break;
      }
      const vectors = await this.openai.embed(pending.map((c) => c.content));
      // Bulk update: one statement per batch (50 rows) instead of one per row —
      // critical over a remote database where each round-trip costs ~200ms.
      const rows = pending.map(
        (c, i) => Prisma.sql`(${c.id}, ${this.toVectorLiteral(vectors[i])}::vector)`,
      );
      await this.prisma.$executeRaw(
        Prisma.sql`UPDATE knowledge_chunks AS k SET embedding = v.emb
                   FROM (VALUES ${Prisma.join(rows)}) AS v(id, emb)
                   WHERE k.id = v.id`,
      );
      total += pending.length;
    }
    this.logger.log(`Backfilled embeddings for ${total} chunks`);
    return { embedded: total };
  }

  // ─── Retrieval ───────────────────────────────────────────────────────────────

  private async retrieve(
    queryVector: number[],
    topK: number,
    filters: { subjectCode?: string },
  ): Promise<RetrievedChunk[]> {
    const literal = this.toVectorLiteral(queryVector);
    const conditions: Prisma.Sql[] = [Prisma.sql`embedding IS NOT NULL`];
    // Scope by subject only. Grade is NOT filtered here: FET documents cover
    // Grades 10–12 but are tagged with a single representative grade, so a grade
    // filter would wrongly exclude them. The subject code already encodes phase.
    if (filters.subjectCode) {
      conditions.push(Prisma.sql`subject_code = ${filters.subjectCode}`);
    }
    const where = Prisma.join(conditions, ' AND ');

    return this.prisma.$queryRaw<RetrievedChunk[]>(Prisma.sql`
      SELECT id, content, 1 - (embedding <=> ${literal}::vector) AS score
      FROM knowledge_chunks
      WHERE ${where}
      ORDER BY embedding <=> ${literal}::vector
      LIMIT ${topK}
    `);
  }

  // ─── Ask (the full grounded pipeline) ────────────────────────────────────────

  async ask(studentId: string | undefined, dto: AskDto): Promise<AskResult> {
    if (!this.openai.isConfigured) {
      throw new ServiceUnavailableException('AI service is not configured');
    }
    const { topK, minSimilarity } = await this.retrievalParams();

    const queryVector = await this.openai.embedOne(dto.question);
    const retrieved = await this.retrieve(queryVector, topK, { subjectCode: dto.subjectCode });
    const grounded = retrieved.filter((c) => c.score >= minSimilarity);

    // 1) GROUNDED path — relevant CAPS material was found. Answer strictly from it.
    if (grounded.length > 0) {
      const passages = grounded.map((c, i) => ({ index: i + 1, content: c.content }));
      const result = await this.openai.chat(
        GROUNDED_SYSTEM_PROMPT,
        buildUserMessage(dto.question, passages),
      );
      const refused = result.content === REFUSAL_MESSAGE || result.content.length === 0;
      if (!refused) {
        await this.logQuery(studentId, dto.question, true, result.content, grounded, result);
        return {
          answered: true,
          grounded: true,
          answer: result.content,
          citations: grounded.map((c) => ({
            chunkId: c.id,
            score: Number(c.score.toFixed(4)),
            preview: c.content.slice(0, 160),
          })),
        };
      }
      // Context was insufficient → fall through to scoped teaching.
    }

    // 2) SCOPED-TEACHING path — no usable source, but teach the concept within the
    //    student's grade + subject scope (declines non-academic / unverifiable asks).
    const subjectName = await this.resolveSubjectName(dto.subjectCode);
    const teaching = await this.openai.chat(
      buildTeachingSystemPrompt(dto.grade, subjectName),
      dto.question,
    );
    const declined = teaching.content === OUT_OF_SCOPE_MESSAGE || teaching.content.length === 0;
    const answer = teaching.content || OUT_OF_SCOPE_MESSAGE;

    await this.logQuery(studentId, dto.question, !declined, answer, [], teaching);
    return { answered: !declined, grounded: false, answer, citations: [] };
  }

  // ─── Lesson (teach a topic, syllabus-guided) ────────────────────────────────

  async lesson(dto: LessonDto): Promise<LessonResult> {
    if (!this.openai.isConfigured) {
      throw new ServiceUnavailableException('AI service is not configured');
    }
    const topic = await this.prisma.topic.findUnique({
      where: { id: dto.topicId },
      include: { subject: true },
    });
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }
    const { subject } = topic;

    const vector = await this.openai.embedOne(`${subject.name}: ${topic.title}`);
    const retrieved = await this.retrieve(vector, 6, { subjectCode: subject.code });
    const grounded = retrieved.length > 0;
    const context = grounded
      ? retrieved.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n')
      : '(No specific source found — teach from established CAPS curriculum knowledge.)';

    const lesson = await this.openai.chatJson<Omit<LessonResult, 'topicId' | 'topicTitle' | 'subjectName' | 'grounded'>>(
      buildLessonSystemPrompt(subject.grade, subject.name, topic.title),
      `SYLLABUS CONTEXT:\n${context}\n\nTeach the topic "${topic.title}".`,
    );

    return {
      topicId: topic.id,
      topicTitle: topic.title,
      subjectName: subject.name,
      grounded,
      introduction: lesson.introduction ?? '',
      sections: Array.isArray(lesson.sections) ? lesson.sections : [],
      workedExample: lesson.workedExample ?? '',
      keyTakeaways: Array.isArray(lesson.keyTakeaways) ? lesson.keyTakeaways : [],
    };
  }

  /**
   * Retrieve CAPS syllabus context for a topic as a single text block, for callers
   * (like the conversational tutor) that teach within scope but aren't strict RAG.
   * Returns a usable context string even when nothing matched, so teaching never blocks.
   */
  async topicContext(subjectCode: string, query: string): Promise<{ context: string; grounded: boolean }> {
    if (!this.openai.isConfigured) {
      return { context: '(No syllabus source available.)', grounded: false };
    }
    try {
      const vector = await this.openai.embedOne(query);
      const retrieved = await this.retrieve(vector, 6, { subjectCode });
      if (retrieved.length === 0) {
        return { context: '(No specific source found — teach from established CAPS curriculum knowledge.)', grounded: false };
      }
      return { context: retrieved.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n'), grounded: true };
    } catch {
      return { context: '(Syllabus lookup unavailable — teach from established CAPS curriculum knowledge.)', grounded: false };
    }
  }

  private async resolveSubjectName(subjectCode?: string): Promise<string | undefined> {
    if (!subjectCode) {
      return undefined;
    }
    const subject = await this.prisma.subject.findUnique({ where: { code: subjectCode } });
    return subject?.name;
  }

  // ─── Persistence ─────────────────────────────────────────────────────────────

  private async logQuery(
    studentId: string | undefined,
    question: string,
    answered: boolean,
    answer: string,
    citations: RetrievedChunk[],
    chat: { model: string; promptTokens: number; completionTokens: number } | null,
  ): Promise<void> {
    await this.prisma.aiQuery.create({
      data: {
        studentId,
        question,
        answered,
        answer,
        model: chat?.model,
        promptTokens: chat?.promptTokens,
        completionTokens: chat?.completionTokens,
        citations: {
          create: citations.map((c) => ({ chunkId: c.id, score: c.score })),
        },
      },
    });
  }

  private toVectorLiteral(vector: number[]): string {
    return `[${vector.join(',')}]`;
  }
}
