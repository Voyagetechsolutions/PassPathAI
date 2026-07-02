import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface TopicResult {
  topicId: string;
  attempts: number;
  correct: number;
}

export interface MistakeInput {
  questionId: string;
  topicId?: string;
}

/**
 * Module 7 — Weakness Tracking (write side). Maintains cumulative TopicMastery,
 * the WeakTopicProfile flag list, and repeat-mistake counts. Other modules
 * (diagnostics, exams, practice) feed results in; consumers (roadmap, dashboard)
 * read the resulting scores.
 */
@Injectable()
export class WeaknessService {
  /** A topic is "weak" once mastery drops to/below this. */
  static readonly WEAK_THRESHOLD = 0.5;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Apply a batch of per-topic results to the student's mastery profile and
   * refresh their weak-topic list. `source` records what produced the results.
   */
  async recordResults(studentId: string, results: TopicResult[], source: string): Promise<void> {
    for (const r of results) {
      const existing = await this.prisma.topicMastery.findUnique({
        where: { studentId_topicId: { studentId, topicId: r.topicId } },
      });
      const attempts = (existing?.attempts ?? 0) + r.attempts;
      const correct = (existing?.correct ?? 0) + r.correct;
      const masteryScore = attempts > 0 ? correct / attempts : 0;
      const weaknessScore = 1 - masteryScore;

      await this.prisma.topicMastery.upsert({
        where: { studentId_topicId: { studentId, topicId: r.topicId } },
        update: { attempts, correct, masteryScore, weaknessScore },
        create: { studentId, topicId: r.topicId, attempts, correct, masteryScore, weaknessScore },
      });

      // Keep the weak-topic list accurate: flag when weak, clear when recovered.
      if (weaknessScore >= WeaknessService.WEAK_THRESHOLD) {
        await this.prisma.weakTopicProfile.upsert({
          where: { studentId_topicId: { studentId, topicId: r.topicId } },
          update: { weaknessScore, source },
          create: { studentId, topicId: r.topicId, weaknessScore, source },
        });
      } else {
        await this.prisma.weakTopicProfile.deleteMany({
          where: { studentId, topicId: r.topicId },
        });
      }
    }
  }

  /**
   * Increment repeat-mistake counters for incorrectly answered questions.
   */
  async recordMistakes(studentId: string, mistakes: MistakeInput[]): Promise<void> {
    for (const m of mistakes) {
      await this.prisma.mistakeLog.upsert({
        where: { studentId_questionId: { studentId, questionId: m.questionId } },
        update: { count: { increment: 1 }, lastSeenAt: new Date(), topicId: m.topicId },
        create: { studentId, questionId: m.questionId, topicId: m.topicId, count: 1 },
      });
    }
  }

  async getWeakTopics(studentId: string) {
    return this.prisma.weakTopicProfile.findMany({
      where: { studentId },
      orderBy: { weaknessScore: 'desc' },
      include: { topic: { select: { id: true, title: true, subjectId: true, importance: true } } },
    });
  }

  async getMastery(studentId: string) {
    return this.prisma.topicMastery.findMany({
      where: { studentId },
      orderBy: { masteryScore: 'asc' },
      include: { topic: { select: { id: true, title: true, subjectId: true } } },
    });
  }
}
