import { Injectable, NotFoundException } from '@nestjs/common';
import { Role, TestStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { UpsertAiSettingDto } from './dto/upsert-ai-setting.dto';

/**
 * Module 14 — Admin Panel. User management, AI settings, platform stats and the
 * audit trail. Curriculum/career/exam management live in their own modules'
 * admin-guarded endpoints; this service covers the cross-cutting admin concerns.
 */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Users ─────────────────────────────────────────────────────────────────

  listUsers(role?: Role) {
    return this.prisma.user.findMany({
      where: role ? { role } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        studentProfile: { select: { firstName: true, surname: true, grade: true } },
        parentProfile: { select: { firstName: true, surname: true } },
      },
    });
  }

  async setUserStatus(actorId: string, userId: string, isActive: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { isActive } });
    await this.audit(actorId, isActive ? 'user.activate' : 'user.suspend', userId);
    return { id: updated.id, isActive: updated.isActive };
  }

  // ─── AI settings ──────────────────────────────────────────────────────────

  listAiSettings() {
    return this.prisma.aiSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async upsertAiSetting(actorId: string, dto: UpsertAiSettingDto) {
    const setting = await this.prisma.aiSetting.upsert({
      where: { key: dto.key },
      update: { value: dto.value },
      create: { key: dto.key, value: dto.value },
    });
    await this.audit(actorId, 'ai_setting.update', dto.key, { value: dto.value });
    return setting;
  }

  // ─── Stats + audit ───────────────────────────────────────────────────────────

  async getStats() {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      users, students, parents, onboarded,
      subjects, questions, lessons, careers,
      activeWeek, activeToday, attempts, avgScore, streakAgg, aiQueries,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: Role.student } }),
      this.prisma.user.count({ where: { role: Role.parent } }),
      this.prisma.studentProfile.count({ where: { onboarded: true } }),
      this.prisma.subject.count(),
      this.prisma.question.count(),
      this.prisma.lesson.count(),
      this.prisma.career.count(),
      this.prisma.studyStreak.count({ where: { lastActiveDate: { gte: weekAgo } } }),
      this.prisma.studyStreak.count({ where: { lastActiveDate: { gte: todayStart } } }),
      this.prisma.diagnosticAttempt.count({ where: { status: TestStatus.GRADED } }),
      this.prisma.diagnosticAttempt.aggregate({
        _avg: { scorePercent: true },
        where: { status: TestStatus.GRADED },
      }),
      this.prisma.studyStreak.aggregate({ _avg: { currentStreak: true }, _max: { longestStreak: true } }),
      this.prisma.aiQuery.count(),
    ]);

    return {
      content: { subjects, questions, lessons, careers },
      users: { total: users, students, parents, onboarded },
      engagement: {
        activeToday,
        activeThisWeek: activeWeek,
        diagnosticAttempts: attempts,
        avgDiagnosticScore: Math.round(avgScore._avg.scorePercent ?? 0),
        avgStreak: Math.round((streakAgg._avg.currentStreak ?? 0) * 10) / 10,
        longestStreak: streakAgg._max.longestStreak ?? 0,
        aiQueries,
      },
    };
  }

  listAuditLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { actor: { select: { email: true, role: true } } },
    });
  }

  private audit(
    actorId: string,
    action: string,
    target?: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: { actorId, action, target, metadata: metadata as object },
    });
  }
}
