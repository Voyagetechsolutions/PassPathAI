import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { LinkChildDto } from './dto/link-child.dto';

/**
 * Module 13 — Parent Dashboard. Lets a parent link to their child's account and
 * view that child's performance (reusing the student dashboard, read-only),
 * study consistency, weak subjects and predicted outcomes.
 */
@Injectable()
export class ParentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
  ) {}

  async linkChild(parentId: string | undefined, dto: LinkChildDto) {
    const pid = this.requireParent(parentId);
    const user = await this.prisma.user.findUnique({
      where: { email: dto.studentEmail },
      include: { studentProfile: { select: { id: true } } },
    });
    if (!user?.studentProfile) {
      throw new NotFoundException('No student account found for that email');
    }
    const existing = await this.prisma.parentChild.findUnique({
      where: { parentId_studentId: { parentId: pid, studentId: user.studentProfile.id } },
    });
    if (existing) {
      throw new BadRequestException('Child already linked');
    }
    return this.prisma.parentChild.create({
      data: { parentId: pid, studentId: user.studentProfile.id },
    });
  }

  async listChildren(parentId: string | undefined) {
    const pid = this.requireParent(parentId);
    const links = await this.prisma.parentChild.findMany({
      where: { parentId: pid },
      include: {
        student: {
          select: { id: true, firstName: true, surname: true, grade: true, school: true },
        },
      },
    });
    return links.map((l) => l.student);
  }

  async getChildDashboard(parentId: string | undefined, studentId: string) {
    const pid = this.requireParent(parentId);
    await this.assertLinked(pid, studentId);

    const [dashboard, weakTopics, streak] = await Promise.all([
      this.dashboard.getDashboard(studentId),
      this.prisma.weakTopicProfile.findMany({
        where: { studentId },
        orderBy: { weaknessScore: 'desc' },
        include: { topic: { select: { title: true, subject: { select: { name: true } } } } },
      }),
      this.prisma.studyStreak.findUnique({ where: { studentId } }),
    ]);

    return {
      performance: dashboard,
      weakSubjects: this.summariseWeakSubjects(weakTopics),
      studyConsistency: {
        currentStreak: streak?.currentStreak ?? 0,
        longestStreak: streak?.longestStreak ?? 0,
        lastActiveDate: streak?.lastActiveDate ?? null,
      },
    };
  }

  // ─── helpers ─────────────────────────────────────────────────────────────────

  private summariseWeakSubjects(
    weakTopics: Array<{ weaknessScore: number; topic: { subject: { name: string } } }>,
  ): Array<{ subject: string; weakTopicCount: number; avgWeakness: number }> {
    const bySubject = new Map<string, { count: number; sum: number }>();
    for (const w of weakTopics) {
      const name = w.topic.subject.name;
      const agg = bySubject.get(name) ?? { count: 0, sum: 0 };
      agg.count += 1;
      agg.sum += w.weaknessScore;
      bySubject.set(name, agg);
    }
    return [...bySubject.entries()]
      .map(([subject, agg]) => ({
        subject,
        weakTopicCount: agg.count,
        avgWeakness: Math.round((agg.sum / agg.count) * 100) / 100,
      }))
      .sort((a, b) => b.avgWeakness - a.avgWeakness);
  }

  private async assertLinked(parentId: string, studentId: string): Promise<void> {
    const link = await this.prisma.parentChild.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
    });
    if (!link) {
      throw new ForbiddenException('This child is not linked to your account');
    }
  }

  private requireParent(parentId: string | undefined): string {
    if (!parentId) {
      throw new ForbiddenException('Only parents can access this resource');
    }
    return parentId;
  }
}
