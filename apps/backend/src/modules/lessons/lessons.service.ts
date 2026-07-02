import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { LessonStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OpenAiService } from '../../infra/openai/openai.service';
import {
  buildExplainStylePrompt,
  buildLessonContentPrompt,
  buildLessonReviewPrompt,
} from '../ai/prompts';

interface GeneratedLesson {
  learningObjective: string;
  introduction: string;
  sections: Array<{ heading: string; content: string }>;
  workedExamples: Array<{ problem: string; solution: string }>;
  commonMistakes: string[];
  memoryTricks: string[];
  examTips: string[];
  revisionSummary: string;
}

/**
 * The owned lesson library. Lessons are STRUCTURED RECORDS generated once (AI-drafted,
 * grounded in the CAPS syllabus), stored, served from the database, and improved over
 * time from student feedback — not regenerated live on every request.
 */
@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiService,
  ) {}

  /** Serve a topic's lesson, drafting + storing it the first time it's requested. */
  async getForTopic(topicId: string, regenerate = false) {
    const existing = await this.prisma.lesson.findUnique({ where: { topicId } });
    if (existing && !regenerate) {
      return this.present(existing);
    }
    return this.present(await this.generateAndStore(topicId));
  }

  /** The content-creation pipeline: draft an original lesson and store it. */
  async generateAndStore(topicId: string) {
    if (!this.openai.isConfigured) {
      throw new ServiceUnavailableException('AI service is not configured');
    }
    const topic = await this.prisma.topic.findUnique({
      where: { id: topicId },
      include: { subject: true },
    });
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }
    const { subject } = topic;

    const chunks = await this.retrieveContext(subject.code, subject.name, topic.title);
    const grounded = chunks.length > 0;
    const context = grounded
      ? chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n')
      : '(No specific source — write from established CAPS curriculum knowledge.)';

    // 1) Draft the original lesson, grounded in the syllabus scope.
    const draft = await this.openai.chatJson<GeneratedLesson>(
      buildLessonContentPrompt(subject.grade, subject.name, topic.title),
      `SYLLABUS CONTEXT:\n${context}\n\nWrite the lesson for "${topic.title}".`,
    );

    // 2) Self-review pass — a second model checks accuracy/clarity and fixes it.
    let final = draft;
    try {
      const reviewed = await this.openai.chatJson<GeneratedLesson>(
        buildLessonReviewPrompt(subject.grade, subject.name, topic.title),
        `DRAFT LESSON:\n${JSON.stringify(draft)}`,
      );
      if (reviewed && Array.isArray(reviewed.sections) && reviewed.sections.length > 0) {
        final = reviewed;
      }
    } catch (e) {
      this.logger.warn(`Lesson review pass failed (${topic.title}), keeping draft: ${(e as Error).message}`);
    }
    const draftLesson = final;

    const data = {
      subjectId: subject.id,
      learningObjective: draftLesson.learningObjective ?? '',
      introduction: draftLesson.introduction ?? '',
      sections: (draftLesson.sections ?? []) as unknown as Prisma.InputJsonValue,
      workedExamples: (draftLesson.workedExamples ?? []) as unknown as Prisma.InputJsonValue,
      commonMistakes: (draftLesson.commonMistakes ?? []) as unknown as Prisma.InputJsonValue,
      memoryTricks: (draftLesson.memoryTricks ?? []) as unknown as Prisma.InputJsonValue,
      examTips: (draftLesson.examTips ?? []) as unknown as Prisma.InputJsonValue,
      revisionSummary: draftLesson.revisionSummary ?? '',
      grounded,
      status: LessonStatus.DRAFT,
      model: this.openai.chatModelName,
    };

    const lesson = await this.prisma.lesson.upsert({
      where: { topicId },
      update: data,
      create: { topicId, ...data },
    });
    this.logger.log(`Drafted lesson for topic ${topicId} (${topic.title})`);
    return lesson;
  }

  async recordFeedback(studentId: string, topicId: string, helpful: boolean) {
    const lesson = await this.prisma.lesson.findUnique({ where: { topicId } });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    const prior = await this.prisma.lessonFeedback.findUnique({
      where: { lessonId_studentId: { lessonId: lesson.id, studentId } },
    });
    await this.prisma.lessonFeedback.upsert({
      where: { lessonId_studentId: { lessonId: lesson.id, studentId } },
      update: { helpful },
      create: { lessonId: lesson.id, studentId, helpful },
    });
    // Maintain aggregate counts (adjust for a changed vote).
    const helpfulDelta = (helpful ? 1 : 0) - (prior?.helpful ? 1 : 0);
    const notHelpfulDelta = (helpful ? 0 : 1) - (prior && !prior.helpful ? 1 : 0);
    await this.prisma.lesson.update({
      where: { id: lesson.id },
      data: {
        helpfulCount: { increment: helpfulDelta },
        notHelpfulCount: { increment: notHelpfulDelta },
      },
    });
    return { ok: true };
  }

  /** Re-explain a stored lesson in a chosen teaching style (one lesson → many ways). */
  async explainInStyle(topicId: string, style: string) {
    if (!this.openai.isConfigured) {
      throw new ServiceUnavailableException('AI service is not configured');
    }
    const lesson = await this.prisma.lesson.findUnique({
      where: { topicId },
      include: { topic: { include: { subject: true } } },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    const subject = lesson.topic.subject;
    const sections = (lesson.sections as Array<{ heading: string; content: string }>) ?? [];
    const lessonText = [
      lesson.introduction,
      ...sections.map((s) => `${s.heading}: ${s.content}`),
      lesson.revisionSummary,
    ].join('\n');
    const result = await this.openai.chat(
      buildExplainStylePrompt(subject.grade, subject.name, lesson.topic.title, style),
      `LESSON:\n${lessonText}`,
    );
    return { style, explanation: result.content };
  }

  /** Review workflow: move a lesson DRAFT → REVIEWED → PUBLISHED. */
  async setStatus(topicId: string, status: LessonStatus) {
    const lesson = await this.prisma.lesson.findUnique({ where: { topicId } });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    await this.prisma.lesson.update({ where: { id: lesson.id }, data: { status } });
    return { topicId, status };
  }

  // ─── helpers ─────────────────────────────────────────────────────────────────

  private async retrieveContext(
    subjectCode: string,
    subjectName: string,
    topicTitle: string,
  ): Promise<Array<{ content: string }>> {
    try {
      const vector = await this.openai.embedOne(`${subjectName} ${topicTitle}`.trim());
      const literal = `[${vector.join(',')}]`;
      return await this.prisma.$queryRaw<Array<{ content: string }>>(Prisma.sql`
        SELECT content FROM knowledge_chunks
        WHERE embedding IS NOT NULL AND subject_code = ${subjectCode}
        ORDER BY embedding <=> ${literal}::vector
        LIMIT 8
      `);
    } catch (e) {
      this.logger.warn(`Lesson grounding retrieval failed: ${(e as Error).message}`);
      return [];
    }
  }

  private present(lesson: {
    id: string;
    topicId: string;
    learningObjective: string;
    introduction: string;
    sections: unknown;
    workedExamples: unknown;
    commonMistakes: unknown;
    memoryTricks: unknown;
    examTips: unknown;
    revisionSummary: string;
    grounded: boolean;
    status: LessonStatus;
    helpfulCount: number;
    notHelpfulCount: number;
  }) {
    return {
      id: lesson.id,
      topicId: lesson.topicId,
      learningObjective: lesson.learningObjective,
      introduction: lesson.introduction,
      sections: (lesson.sections as Array<{ heading: string; content: string }>) ?? [],
      workedExamples: (lesson.workedExamples as Array<{ problem: string; solution: string }>) ?? [],
      commonMistakes: (lesson.commonMistakes as string[]) ?? [],
      memoryTricks: (lesson.memoryTricks as string[]) ?? [],
      examTips: (lesson.examTips as string[]) ?? [],
      revisionSummary: lesson.revisionSummary,
      grounded: lesson.grounded,
      status: lesson.status,
      helpfulCount: lesson.helpfulCount,
      notHelpfulCount: lesson.notHelpfulCount,
    };
  }
}
