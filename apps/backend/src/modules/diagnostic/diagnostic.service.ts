import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuestionType, TestStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { WeaknessService, TopicResult } from '../weakness/weakness.service';
import { RoadmapService } from '../roadmap/roadmap.service';
import { GenerateDiagnosticDto } from './dto/generate-diagnostic.dto';
import { SubmitDiagnosticDto } from './dto/submit-diagnostic.dto';

/**
 * Module 4 — Diagnostic Test Engine. Generates a multiple-choice diagnostic from
 * the question bank, scores submissions deterministically, and feeds the result
 * into the weakness/mastery profile (Module 7).
 */
@Injectable()
export class DiagnosticService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weakness: WeaknessService,
    private readonly roadmap: RoadmapService,
  ) {}

  /**
   * Assemble a diagnostic test by sampling MCQ questions across the subject's
   * topics, then persist it for re-use/auditing.
   */
  async generate(dto: GenerateDiagnosticDto) {
    const count = dto.questionCount ?? 10;
    const subject = await this.prisma.subject.findUnique({ where: { id: dto.subjectId } });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    const pool = await this.prisma.question.findMany({
      where: {
        subjectId: dto.subjectId,
        type: QuestionType.MULTIPLE_CHOICE,
        ...(dto.topicId ? { topicId: dto.topicId } : {}),
      },
      select: { id: true, topicId: true },
    });
    if (pool.length === 0) {
      throw new BadRequestException('No questions available yet for this selection');
    }

    const topic = dto.topicId
      ? await this.prisma.topic.findUnique({ where: { id: dto.topicId }, select: { title: true } })
      : null;
    const picked = this.sampleSpreadAcrossTopics(pool, count);
    const title = topic
      ? `${topic.title} — quick check (${picked.length} questions)`
      : `${subject.name} Diagnostic (${picked.length} questions)`;
    const test = await this.prisma.diagnosticTest.create({
      data: {
        subjectId: subject.id,
        grade: subject.grade,
        title,
        items: { create: picked.map((q, i) => ({ questionId: q.id, orderIndex: i })) },
      },
      select: { id: true, title: true, grade: true, subjectId: true },
    });
    return { ...test, questionCount: picked.length };
  }

  /**
   * Start an attempt and return the questions (without revealing correct answers).
   */
  async start(studentId: string | undefined, testId: string) {
    const sid = this.requireStudent(studentId);
    const test = await this.prisma.diagnosticTest.findUnique({
      where: { id: testId },
      include: {
        items: {
          orderBy: { orderIndex: 'asc' },
          include: {
            question: {
              include: { options: { select: { id: true, label: true, text: true } } },
            },
          },
        },
      },
    });
    if (!test) {
      throw new NotFoundException('Diagnostic test not found');
    }

    const attempt = await this.prisma.diagnosticAttempt.create({
      data: { testId, studentId: sid, status: TestStatus.IN_PROGRESS },
      select: { id: true, startedAt: true },
    });

    return {
      attemptId: attempt.id,
      testId: test.id,
      title: test.title,
      startedAt: attempt.startedAt,
      questions: test.items.map((item) => ({
        id: item.question.id,
        prompt: item.question.prompt,
        type: item.question.type,
        marks: item.question.marks,
        options: item.question.options,
      })),
    };
  }

  /**
   * Score a submission, persist answers, and update the weakness profile.
   */
  async submit(studentId: string | undefined, attemptId: string, dto: SubmitDiagnosticDto) {
    const sid = this.requireStudent(studentId);
    const attempt = await this.prisma.diagnosticAttempt.findUnique({
      where: { id: attemptId },
      include: {
        test: {
          include: {
            items: {
              include: {
                question: {
                  include: { options: true, topic: { select: { id: true, title: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }
    if (attempt.studentId !== sid) {
      throw new ForbiddenException('Not your attempt');
    }
    if (attempt.status !== TestStatus.IN_PROGRESS) {
      throw new BadRequestException('Attempt already submitted');
    }

    const responseByQuestion = new Map(dto.answers.map((a) => [a.questionId, a.response]));

    // Per-topic tallies + per-question correctness.
    const topicTally = new Map<string, { title: string; total: number; correct: number }>();
    const answerRows: Array<{ questionId: string; response: string; isCorrect: boolean }> = [];
    const mistakes: Array<{ questionId: string; topicId?: string }> = [];
    let correctCount = 0;

    for (const item of attempt.test.items) {
      const q = item.question;
      const correctLabel = q.options.find((o) => o.isCorrect)?.label ?? null;
      const response = responseByQuestion.get(q.id) ?? '';
      const isCorrect =
        correctLabel !== null && response.trim().toUpperCase() === correctLabel.toUpperCase();

      answerRows.push({ questionId: q.id, response, isCorrect });
      if (isCorrect) {
        correctCount += 1;
      } else {
        mistakes.push({ questionId: q.id, topicId: q.topicId });
      }

      const t = topicTally.get(q.topicId) ?? { title: q.topic.title, total: 0, correct: 0 };
      t.total += 1;
      t.correct += isCorrect ? 1 : 0;
      topicTally.set(q.topicId, t);
    }

    const total = attempt.test.items.length;
    const scorePercent = total > 0 ? Math.round((correctCount / total) * 10000) / 100 : 0;

    await this.prisma.$transaction([
      this.prisma.diagnosticAnswer.createMany({
        data: answerRows.map((a) => ({
          attemptId,
          questionId: a.questionId,
          response: a.response,
          isCorrect: a.isCorrect,
        })),
      }),
      this.prisma.diagnosticAttempt.update({
        where: { id: attemptId },
        data: { status: TestStatus.GRADED, scorePercent, submittedAt: new Date() },
      }),
    ]);

    const topicResults: TopicResult[] = [...topicTally.entries()].map(([topicId, t]) => ({
      topicId,
      attempts: t.total,
      correct: t.correct,
    }));
    await this.weakness.recordResults(sid, topicResults, 'diagnostic');
    await this.weakness.recordMistakes(sid, mistakes);
    // Reflect demonstrated mastery in the subject mark (only ever increases it).
    const newSubjectMark = await this.updateSubjectMark(sid, attempt.test.subjectId);
    // Habit loop: finishing a check completes today's matching mission(s) + streak.
    try {
      await this.roadmap.recordTopicCompletion(sid, [...topicTally.keys()]);
    } catch {
      /* non-blocking */
    }

    return {
      attemptId,
      scorePercent,
      total,
      correctCount,
      subjectMark: newSubjectMark,
      topics: [...topicTally.entries()].map(([topicId, t]) => ({
        topicId,
        title: t.title,
        total: t.total,
        correct: t.correct,
        weaknessScore: Math.round((1 - t.correct / t.total) * 100) / 100,
        weak: 1 - t.correct / t.total >= WeaknessService.WEAK_THRESHOLD,
      })),
    };
  }

  /**
   * Recompute the subject mark from demonstrated mastery across its topics. The
   * mark only ever increases — it reflects the best of the student's self-reported
   * starting mark and the mastery they've proven through topic checks. Returns the
   * new mark (or null if the subject has no marks row / no mastery yet).
   */
  private async updateSubjectMark(
    studentId: string,
    subjectId: string,
  ): Promise<number | null> {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      select: { name: true },
    });
    if (!subject) {
      return null;
    }
    const [masteries, totalTopics, existing] = await Promise.all([
      this.prisma.topicMastery.findMany({
        where: { studentId, topic: { subjectId } },
        select: { masteryScore: true },
      }),
      this.prisma.topic.count({ where: { subjectId } }),
      this.prisma.subjectMark.findUnique({
        where: { studentId_subjectName: { studentId, subjectName: subject.name } },
      }),
    ]);
    if (totalTopics === 0) {
      return existing?.mark ?? null;
    }
    // Fraction of the whole subject's mastery the student has demonstrated.
    const sumMastery = masteries.reduce((s, m) => s + m.masteryScore, 0);
    const masteryMark = Math.round((sumMastery / totalTopics) * 100);
    const newMark = Math.max(existing?.mark ?? 0, masteryMark);

    await this.prisma.subjectMark.upsert({
      where: { studentId_subjectName: { studentId, subjectName: subject.name } },
      update: { mark: newMark },
      create: { studentId, subjectName: subject.name, mark: newMark },
    });
    return newMark;
  }

  async getAttempt(studentId: string | undefined, attemptId: string) {
    const sid = this.requireStudent(studentId);
    const attempt = await this.prisma.diagnosticAttempt.findUnique({
      where: { id: attemptId },
      include: { answers: true },
    });
    if (!attempt || attempt.studentId !== sid) {
      throw new NotFoundException('Attempt not found');
    }
    return attempt;
  }

  // ─── helpers ─────────────────────────────────────────────────────────────────

  private requireStudent(studentId: string | undefined): string {
    if (!studentId) {
      throw new ForbiddenException('Only students can take diagnostics');
    }
    return studentId;
  }

  /**
   * Round-robin sample across topics so the diagnostic spans the subject rather
   * than clustering on one topic. Falls back to a plain slice when needed.
   */
  private sampleSpreadAcrossTopics<T extends { id: string; topicId: string }>(
    pool: T[],
    count: number,
  ): T[] {
    const byTopic = new Map<string, T[]>();
    for (const q of this.shuffle(pool)) {
      const list = byTopic.get(q.topicId) ?? [];
      list.push(q);
      byTopic.set(q.topicId, list);
    }
    const queues = [...byTopic.values()];
    const picked: T[] = [];
    let progressed = true;
    while (picked.length < count && progressed) {
      progressed = false;
      for (const queue of queues) {
        if (picked.length >= count) {
          break;
        }
        const next = queue.shift();
        if (next) {
          picked.push(next);
          progressed = true;
        }
      }
    }
    return picked;
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}
