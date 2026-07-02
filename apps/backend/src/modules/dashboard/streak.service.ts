import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

/**
 * Maintains the study streak (Module 10). Activity on consecutive calendar days
 * extends the streak; a gap resets it. Same-day activity is idempotent.
 */
@Injectable()
export class StreakService {
  constructor(private readonly prisma: PrismaService) {}

  async recordActivity(studentId: string, when: Date = new Date()): Promise<void> {
    const today = this.startOfDay(when);
    const streak = await this.prisma.studyStreak.findUnique({ where: { studentId } });

    if (!streak) {
      await this.prisma.studyStreak.create({
        data: { studentId, currentStreak: 1, longestStreak: 1, lastActiveDate: today },
      });
      return;
    }

    const last = streak.lastActiveDate ? this.startOfDay(streak.lastActiveDate) : null;
    const dayGap = last ? this.dayDiff(last, today) : null;

    let current = streak.currentStreak;
    if (dayGap === 0) {
      return; // already counted today
    } else if (dayGap === 1) {
      current += 1;
    } else {
      current = 1; // gap (or first ever) → restart
    }

    await this.prisma.studyStreak.update({
      where: { studentId },
      data: {
        currentStreak: current,
        longestStreak: Math.max(current, streak.longestStreak),
        lastActiveDate: today,
      },
    });
  }

  async getStreak(studentId: string) {
    const streak = await this.prisma.studyStreak.findUnique({ where: { studentId } });
    return {
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      lastActiveDate: streak?.lastActiveDate ?? null,
    };
  }

  private startOfDay(d: Date): Date {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  private dayDiff(a: Date, b: Date): number {
    const ms = b.getTime() - a.getTime();
    return Math.round(ms / 86_400_000);
  }
}
