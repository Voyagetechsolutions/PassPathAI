import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Difficulty, QuestionType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OpenAiService } from '../../infra/openai/openai.service';
import { WeaknessService } from '../weakness/weakness.service';
import { buildExplainWrongPrompt } from '../ai/prompts';
import { AnswerDto } from './dto/answer.dto';

const ENCOURAGEMENT = [
  'Nice — you’ve got it.',
  'Correct! That’s the idea.',
  'Spot on. Keep going.',
  'Yes! You’re getting stronger at this.',
];

/**
 * Adaptive practice — the learner-based loop. It meets the student at their level
 * (a struggling student gets easier questions first) and, when they get one wrong,
 * the AI tutor explains the misconception instead of just marking it failed.
 */
@Injectable()
export class PracticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weakness: WeaknessService,
    private readonly openai: OpenAiService,
  ) {}

  private requireStudent(studentId: string | undefined): string {
    if (!studentId) {
      throw new ForbiddenException('Only students can practise');
    }
    return studentId;
  }

  /** Pick the next question at the student's current level for a topic. */
  async next(studentId: string | undefined, topicId: string) {
    const sid = this.requireStudent(studentId);
    const topic = await this.prisma.topic.findUnique({ where: { id: topicId } });
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }
    const mastery = await this.prisma.topicMastery.findFirst({ where: { studentId: sid, topicId } });
    const score = mastery?.masteryScore ?? 0;
    // Be gentle: strugglers (and brand-new topics) start easy and only climb when ready.
    const target = score < 0.4 ? Difficulty.EASY : score < 0.75 ? Difficulty.MEDIUM : Difficulty.HARD;

    const q = await this.pickQuestion(topicId, target);
    if (!q) {
      throw new BadRequestException('No practice questions for this topic yet.');
    }
    return {
      questionId: q.id,
      prompt: q.prompt,
      difficulty: q.difficulty,
      masteryScore: Math.round(score * 100),
      options: q.options.map((o) => ({ label: o.label, text: o.text })),
    };
  }

  /** Grade an answer; on a wrong answer, teach the misconception. */
  async answer(studentId: string | undefined, dto: AnswerDto) {
    const sid = this.requireStudent(studentId);
    const q = await this.prisma.question.findUnique({
      where: { id: dto.questionId },
      include: { options: true, topic: { include: { subject: true } } },
    });
    if (!q) {
      throw new NotFoundException('Question not found');
    }
    const correctOpt = q.options.find((o) => o.isCorrect);
    const correct = !!correctOpt && dto.response.trim().toUpperCase() === correctOpt.label.toUpperCase();

    await this.weakness.recordResults(
      sid,
      [{ topicId: q.topicId, attempts: 1, correct: correct ? 1 : 0 }],
      'practice',
    );
    const mastery = await this.prisma.topicMastery.findFirst({ where: { studentId: sid, topicId: q.topicId } });
    const masteryScore = Math.round((mastery?.masteryScore ?? 0) * 100);

    if (correct) {
      return {
        correct: true,
        masteryScore,
        message: ENCOURAGEMENT[Math.floor(Math.random() * ENCOURAGEMENT.length)],
      };
    }

    // Wrong → teach, don't just fail.
    let explanation = `The correct answer is ${correctOpt?.label ?? '?'}. Have another look and try the next one.`;
    if (this.openai.isConfigured) {
      try {
        const r = await this.openai.chat(
          buildExplainWrongPrompt(q.topic.subject.grade, q.topic.subject.name, q.topic.title),
          `QUESTION: ${q.prompt}\nOPTIONS:\n${q.options.map((o) => `${o.label}) ${o.text}`).join('\n')}\nSTUDENT CHOSE: ${dto.response}\nCORRECT OPTION: ${correctOpt?.label}`,
        );
        if (r.content) {
          explanation = r.content;
        }
      } catch {
        /* fall back to the simple message */
      }
    }
    return {
      correct: false,
      masteryScore,
      correctLabel: correctOpt?.label ?? null,
      correctText: correctOpt?.text ?? null,
      explanation,
    };
  }

  private async pickQuestion(topicId: string, target: Difficulty) {
    // Try the target level, then fall back so practice never dead-ends.
    const order = [target, Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD];
    for (const difficulty of order) {
      const pool = await this.prisma.question.findMany({
        where: { topicId, type: QuestionType.MULTIPLE_CHOICE, difficulty },
        include: { options: { select: { label: true, text: true } } },
        take: 30,
      });
      const usable = pool.filter((q) => q.options.length >= 2);
      if (usable.length > 0) {
        return usable[Math.floor(Math.random() * usable.length)];
      }
    }
    return null;
  }
}
