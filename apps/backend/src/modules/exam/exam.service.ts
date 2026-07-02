import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuestionType, TestStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OpenAiService } from '../../infra/openai/openai.service';
import { WeaknessService, TopicResult } from '../weakness/weakness.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { gradeResponse } from '../../common/utils/grading';
import { buildMarkingPrompt } from '../ai/prompts';
import { GenerateExamDto } from './dto/generate-exam.dto';
import { SubmitExamDto } from './dto/submit-exam.dto';

/** Free accounts get one mock exam to see the format before hitting Premium. */
const FREE_TRIAL_MOCK_EXAMS = 1;

const SECTION_ORDER: QuestionType[] = [
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.SHORT_ANSWER,
  QuestionType.EXAM_STYLE,
];
const SECTION_TITLES: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: 'Section A: Multiple Choice',
  SHORT_ANSWER: 'Section B: Short Answer',
  EXAM_STYLE: 'Section C: Exam-Style Questions',
};

/**
 * Module 9 — Exam Simulation. Builds timed mock papers from the question bank,
 * marks submissions, produces a section/topic breakdown, and feeds results into
 * the shared weakness profile (Module 7).
 */
@Injectable()
export class ExamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weakness: WeaknessService,
    private readonly openai: OpenAiService,
    private readonly subscription: SubscriptionService,
  ) {}

  /** AI-mark a written answer against the model answer, awarding partial marks. */
  private async markWritten(
    prompt: string,
    modelAnswer: string | null,
    response: string,
    maxMarks: number,
  ): Promise<{ marks: number; feedback: string }> {
    if (!response.trim()) {
      return { marks: 0, feedback: 'No answer given.' };
    }
    if (!this.openai.isConfigured) {
      return { marks: 0, feedback: 'Mark this against the model answer.' };
    }
    try {
      const result = await this.openai.chatJson<{ marks?: number; feedback?: string }>(
        buildMarkingPrompt(maxMarks),
        `QUESTION: ${prompt}\nMODEL ANSWER: ${modelAnswer ?? '(none provided)'}\nSTUDENT ANSWER: ${response}`,
      );
      const marks = Math.min(maxMarks, Math.max(0, Math.round(result.marks ?? 0)));
      return { marks, feedback: result.feedback ?? '' };
    } catch {
      return { marks: 0, feedback: 'Could not auto-mark — review against the model answer.' };
    }
  }

  async generate(studentId: string | undefined, dto: GenerateExamDto) {
    if (!studentId) {
      throw new ForbiddenException('Only students can generate a mock exam');
    }
    if (!(await this.subscription.isPremium(studentId))) {
      const usedLifetime = await this.prisma.examPaper.count({
        where: { isMock: true, attempts: { some: { studentId } } },
      });
      if (usedLifetime >= FREE_TRIAL_MOCK_EXAMS) {
        throw new ForbiddenException('Mock exams are a Premium feature — you’ve used your free one. Upgrade to keep practising with full timed papers.');
      }
    }
    const durationMins = dto.durationMins ?? 60;
    const questionCount = dto.questionCount ?? 15;
    const subject = await this.prisma.subject.findUnique({ where: { id: dto.subjectId } });
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    const pool = await this.prisma.question.findMany({
      where: { subjectId: dto.subjectId },
      select: { id: true, type: true, marks: true, topicId: true },
    });
    if (pool.length === 0) {
      throw new BadRequestException('No questions available for this subject');
    }

    const picked = this.shuffle(pool).slice(0, questionCount);
    const byType = new Map<QuestionType, typeof picked>();
    for (const q of picked) {
      const list = byType.get(q.type) ?? [];
      list.push(q);
      byType.set(q.type, list);
    }

    const totalMarks = picked.reduce((sum, q) => sum + q.marks, 0);
    const paper = await this.prisma.examPaper.create({
      data: {
        subjectId: subject.id,
        grade: subject.grade,
        title: `${subject.name} ${dto.isMock === false ? 'Exam' : 'Mock Exam'}`,
        durationMins,
        totalMarks,
        isMock: dto.isMock ?? true,
        sections: {
          create: SECTION_ORDER.filter((t) => byType.has(t)).map((type, sIdx) => ({
            title: SECTION_TITLES[type],
            orderIndex: sIdx,
            items: {
              create: (byType.get(type) ?? []).map((q, i) => ({
                questionId: q.id,
                orderIndex: i,
                marks: q.marks,
              })),
            },
          })),
        },
      },
      select: { id: true, title: true, durationMins: true, totalMarks: true, grade: true },
    });
    return { ...paper, questionCount: picked.length };
  }

  async start(studentId: string | undefined, paperId: string) {
    const sid = this.requireStudent(studentId);
    const paper = await this.prisma.examPaper.findUnique({
      where: { id: paperId },
      include: {
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: {
            items: {
              orderBy: { orderIndex: 'asc' },
              include: {
                question: {
                  select: {
                    prompt: true,
                    type: true,
                    options: { select: { label: true, text: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!paper) {
      throw new NotFoundException('Exam paper not found');
    }

    const startedAt = new Date();
    const deadlineAt = new Date(startedAt.getTime() + paper.durationMins * 60_000);
    const attempt = await this.prisma.examAttempt.create({
      data: { paperId, studentId: sid, status: TestStatus.IN_PROGRESS, startedAt, deadlineAt },
      select: { id: true },
    });

    return {
      attemptId: attempt.id,
      paperId: paper.id,
      title: paper.title,
      durationMins: paper.durationMins,
      totalMarks: paper.totalMarks,
      deadlineAt,
      sections: paper.sections.map((s) => ({
        title: s.title,
        items: s.items.map((it) => ({
          examItemId: it.id,
          marks: it.marks,
          prompt: it.question.prompt,
          type: it.question.type,
          options: it.question.options,
        })),
      })),
    };
  }

  async submit(studentId: string | undefined, attemptId: string, dto: SubmitExamDto) {
    const sid = this.requireStudent(studentId);
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        paper: {
          include: {
            sections: {
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

    const responseByItem = new Map(dto.responses.map((r) => [r.examItemId, r.response]));
    const responseRows: Array<{
      examItemId: string;
      response: string;
      isCorrect: boolean;
      marksAwarded: number;
      feedback: string | null;
    }> = [];
    const topicTally = new Map<string, { title: string; total: number; correct: number }>();
    const mistakes: Array<{ questionId: string; topicId?: string }> = [];
    const sectionBreakdown: Array<{ title: string; awarded: number; total: number }> = [];
    const marked: Array<{ examItemId: string; prompt: string; type: QuestionType; marksAwarded: number; maxMarks: number; feedback: string | null }> = [];
    let marksAwarded = 0;

    // AI-mark all written answers up front, in parallel (keeps submit responsive).
    const allItems = attempt.paper.sections.flatMap((s) => s.items);
    const writtenMarks = new Map<string, { marks: number; feedback: string }>();
    await Promise.all(
      allItems
        .filter((it) => it.question.type !== QuestionType.MULTIPLE_CHOICE)
        .map(async (it) => {
          const res = await this.markWritten(
            it.question.prompt,
            it.question.modelAnswer,
            responseByItem.get(it.id) ?? '',
            it.marks,
          );
          writtenMarks.set(it.id, res);
        }),
    );

    for (const section of attempt.paper.sections) {
      let sectionAwarded = 0;
      let sectionTotal = 0;
      for (const item of section.items) {
        const q = item.question;
        const response = responseByItem.get(item.id) ?? '';

        let awarded: number;
        let feedback: string | null = null;
        if (q.type === QuestionType.MULTIPLE_CHOICE) {
          const correctLabel = q.options.find((o) => o.isCorrect)?.label ?? null;
          awarded = gradeResponse(q.type, response, correctLabel, q.modelAnswer) ? item.marks : 0;
        } else {
          const m = writtenMarks.get(item.id) ?? { marks: 0, feedback: '' };
          awarded = m.marks;
          feedback = m.feedback;
        }
        // "Got it" for weakness tracking = at least half the marks.
        const gotIt = awarded >= item.marks * 0.5;

        responseRows.push({ examItemId: item.id, response, isCorrect: gotIt, marksAwarded: awarded, feedback });
        marked.push({ examItemId: item.id, prompt: q.prompt, type: q.type, marksAwarded: awarded, maxMarks: item.marks, feedback });
        marksAwarded += awarded;
        sectionAwarded += awarded;
        sectionTotal += item.marks;

        if (!gotIt) {
          mistakes.push({ questionId: q.id, topicId: q.topicId });
        }
        const t = topicTally.get(q.topicId) ?? { title: q.topic.title, total: 0, correct: 0 };
        t.total += 1;
        t.correct += gotIt ? 1 : 0;
        topicTally.set(q.topicId, t);
      }
      sectionBreakdown.push({ title: section.title, awarded: sectionAwarded, total: sectionTotal });
    }

    const totalMarks = attempt.paper.totalMarks;
    const scorePercent = totalMarks > 0 ? Math.round((marksAwarded / totalMarks) * 10000) / 100 : 0;

    await this.prisma.$transaction([
      this.prisma.examResponse.createMany({
        data: responseRows.map((r) => ({
          attemptId,
          examItemId: r.examItemId,
          response: r.response,
          isCorrect: r.isCorrect,
          marksAwarded: r.marksAwarded,
          feedback: r.feedback,
        })),
      }),
      this.prisma.examAttempt.update({
        where: { id: attemptId },
        data: {
          status: TestStatus.GRADED,
          scorePercent,
          marksAwarded,
          submittedAt: new Date(),
        },
      }),
    ]);

    const topicResults: TopicResult[] = [...topicTally.entries()].map(([topicId, t]) => ({
      topicId,
      attempts: t.total,
      correct: t.correct,
    }));
    await this.weakness.recordResults(sid, topicResults, 'exam');
    await this.weakness.recordMistakes(sid, mistakes);

    return {
      attemptId,
      scorePercent,
      marksAwarded,
      totalMarks,
      sections: sectionBreakdown,
      responses: marked,
      topics: [...topicTally.entries()].map(([topicId, t]) => ({
        topicId,
        title: t.title,
        total: t.total,
        correct: t.correct,
      })),
    };
  }

  async getAttempt(studentId: string | undefined, attemptId: string) {
    const sid = this.requireStudent(studentId);
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { responses: true, paper: { select: { title: true, totalMarks: true } } },
    });
    if (!attempt || attempt.studentId !== sid) {
      throw new NotFoundException('Attempt not found');
    }
    return attempt;
  }

  // ─── helpers ─────────────────────────────────────────────────────────────────

  private requireStudent(studentId: string | undefined): string {
    if (!studentId) {
      throw new ForbiddenException('Only students can sit exams');
    }
    return studentId;
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
