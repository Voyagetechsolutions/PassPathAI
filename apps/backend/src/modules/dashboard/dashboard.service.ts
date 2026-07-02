import { ForbiddenException, Injectable } from '@nestjs/common';
import { TestStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StreakService } from './streak.service';

/** A topic counts as "completed/mastered" at or above this mastery. */
const MASTERED_THRESHOLD = 0.8;

export interface DashboardView {
  predictedScore: number;
  predictionConfidence: number;
  masteryScore: number;
  completedTopics: number;
  totalTrackedTopics: number;
  weakTopics: Array<{ topicId: string; title: string; weaknessScore: number }>;
  streak: { currentStreak: number; longestStreak: number; lastActiveDate: Date | null };
}

/**
 * Module 10 — Performance Dashboard. Aggregates mastery, weakness, recent
 * assessment results and the study streak into a single view, and records a
 * predicted-score snapshot for trend charts.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly streak: StreakService,
  ) {}

  async getDashboard(studentId: string | undefined): Promise<DashboardView> {
    const sid = this.requireStudent(studentId);

    const [masteries, weakTopics, streak, recentScores] = await Promise.all([
      this.prisma.topicMastery.findMany({ where: { studentId: sid } }),
      this.prisma.weakTopicProfile.findMany({
        where: { studentId: sid },
        orderBy: { weaknessScore: 'desc' },
        take: 5,
        include: { topic: { select: { id: true, title: true } } },
      }),
      this.streak.getStreak(sid),
      this.recentAssessmentScores(sid),
    ]);

    const avgMastery =
      masteries.length > 0
        ? masteries.reduce((sum, m) => sum + m.masteryScore, 0) / masteries.length
        : 0;
    const completedTopics = masteries.filter((m) => m.masteryScore >= MASTERED_THRESHOLD).length;

    const { predictedScore, confidence } = this.predict(avgMastery, recentScores);

    // Note: trend snapshots are written when assessments are submitted, NOT on every
    // dashboard read — a read should never trigger a remote DB write.

    return {
      predictedScore,
      predictionConfidence: confidence,
      masteryScore: Math.round(avgMastery * 10000) / 100,
      completedTopics,
      totalTrackedTopics: masteries.length,
      weakTopics: weakTopics.map((w) => ({
        topicId: w.topicId,
        title: w.topic.title,
        weaknessScore: Math.round(w.weaknessScore * 100) / 100,
      })),
      streak,
    };
  }

  async getPredictionHistory(studentId: string | undefined) {
    const sid = this.requireStudent(studentId);
    return this.prisma.predictionSnapshot.findMany({
      where: { studentId: sid },
      orderBy: { createdAt: 'asc' },
      take: 90,
    });
  }

  // ─── prediction model ─────────────────────────────────────────────────────────

  /**
   * Predicted exam score blends current mastery with recent assessment results.
   * Confidence rises with the amount of evidence (tracked topics + assessments).
   */
  private predict(
    avgMastery: number,
    recentScores: number[],
  ): { predictedScore: number; confidence: number } {
    const masteryComponent = avgMastery * 100;
    const recentAvg =
      recentScores.length > 0
        ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length
        : masteryComponent;

    // Weight recent performance more heavily when it exists.
    const weightRecent = recentScores.length > 0 ? 0.6 : 0;
    const predicted = masteryComponent * (1 - weightRecent) + recentAvg * weightRecent;

    const evidence = recentScores.length + (avgMastery > 0 ? 1 : 0);
    const confidence = Math.min(0.95, 0.3 + evidence * 0.15);

    return {
      predictedScore: Math.round(predicted * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
    };
  }

  private async recentAssessmentScores(studentId: string): Promise<number[]> {
    const [diagnostics, exams] = await Promise.all([
      this.prisma.diagnosticAttempt.findMany({
        where: { studentId, status: TestStatus.GRADED, scorePercent: { not: null } },
        orderBy: { submittedAt: 'desc' },
        take: 5,
        select: { scorePercent: true },
      }),
      this.prisma.examAttempt.findMany({
        where: { studentId, status: TestStatus.GRADED, scorePercent: { not: null } },
        orderBy: { submittedAt: 'desc' },
        take: 5,
        select: { scorePercent: true },
      }),
    ]);
    return [...diagnostics, ...exams]
      .map((a) => a.scorePercent)
      .filter((s): s is number => s !== null);
  }

  private requireStudent(studentId: string | undefined): string {
    if (!studentId) {
      throw new ForbiddenException('Only students have a performance dashboard');
    }
    return studentId;
  }
}
