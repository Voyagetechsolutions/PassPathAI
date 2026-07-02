import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImportantDateType, MissionStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StreakService } from '../dashboard/streak.service';
import { GenerateRoadmapDto } from './dto/generate-roadmap.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';

interface PrioritisedTopic {
  topicId: string;
  title: string;
  subjectId: string;
  reason: string;
  priority: number;
}

/**
 * Module 8 — Study Roadmap. Builds a prioritised study plan (weekly plans +
 * daily missions). Priority blends topic weakness, curriculum importance and
 * proximity of the subject's next exam.
 */
@Injectable()
export class RoadmapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly streak: StreakService,
  ) {}

  async generate(studentId: string | undefined, dto: GenerateRoadmapDto) {
    const sid = this.requireStudent(studentId);
    const days = dto.days ?? 14;
    const perDay = dto.dailyMissionCount ?? 2;

    const profile = await this.prisma.studentProfile.findUniqueOrThrow({ where: { id: sid } });
    const prioritised = await this.buildPriorities(sid, profile.grade);
    if (prioritised.length === 0) {
      throw new BadRequestException(
        'No topics to plan. Enrol in subjects or take a diagnostic first.',
      );
    }

    const start = this.startOfDay(new Date());
    const end = this.addDays(start, days - 1);
    const weekCount = Math.ceil(days / 7);

    // Regenerating replaces the student's plan (weekly plans + missions cascade)
    // so missions don't accumulate/duplicate across re-generations.
    await this.prisma.studyPlan.deleteMany({ where: { studentId: sid } });

    const plan = await this.prisma.studyPlan.create({
      data: { studentId: sid, startDate: start, endDate: end },
    });

    const weeklyPlans = await Promise.all(
      Array.from({ length: weekCount }, (_, w) =>
        this.prisma.weeklyPlan.create({
          data: {
            planId: plan.id,
            weekNumber: w + 1,
            focus: this.weekFocus(prioritised, w, perDay),
          },
        }),
      ),
    );

    // Round-robin assign prioritised topics across each day's mission slots.
    const missions: Array<{
      planId: string;
      weeklyPlanId: string;
      topicId: string;
      date: Date;
      title: string;
      description: string;
      priority: number;
    }> = [];
    let cursor = 0;
    for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
      const date = this.addDays(start, dayIndex);
      const weeklyPlanId = weeklyPlans[Math.floor(dayIndex / 7)].id;
      for (let slot = 0; slot < perDay; slot += 1) {
        const topic = prioritised[cursor % prioritised.length];
        cursor += 1;
        missions.push({
          planId: plan.id,
          weeklyPlanId,
          topicId: topic.topicId,
          date,
          title: `Revise: ${topic.title}`,
          description: topic.reason,
          priority: Math.round(topic.priority * 100),
        });
      }
    }
    await this.prisma.dailyMission.createMany({ data: missions });

    return {
      planId: plan.id,
      startDate: start,
      endDate: end,
      weeks: weeklyPlans.length,
      missions: missions.length,
      topTopics: prioritised.slice(0, 5).map((t) => ({ title: t.title, reason: t.reason })),
    };
  }

  async getCurrent(studentId: string | undefined) {
    const sid = this.requireStudent(studentId);
    const plan = await this.prisma.studyPlan.findFirst({
      where: { studentId: sid },
      orderBy: { createdAt: 'desc' },
      include: {
        weeklyPlans: { orderBy: { weekNumber: 'asc' } },
        missions: { orderBy: [{ date: 'asc' }, { priority: 'desc' }] },
      },
    });
    if (!plan) {
      throw new NotFoundException('No study plan yet. Generate one first.');
    }
    return plan;
  }

  async getTodayMissions(studentId: string | undefined) {
    const sid = this.requireStudent(studentId);
    const start = this.startOfDay(new Date());
    const end = this.addDays(start, 1);
    return this.prisma.dailyMission.findMany({
      where: { plan: { studentId: sid }, date: { gte: start, lt: end } },
      orderBy: { priority: 'desc' },
      include: { topic: { select: { id: true, title: true } } },
    });
  }

  /** The daily habit view: today's goal, progress, streak, and the tasks to do. */
  async getToday(studentId: string | undefined) {
    const sid = this.requireStudent(studentId);
    const start = this.startOfDay(new Date());
    const end = this.addDays(start, 1);
    const include = { topic: { include: { subject: { select: { id: true, name: true } } } } };

    let missions = await this.prisma.dailyMission.findMany({
      where: { plan: { studentId: sid }, date: { gte: start, lt: end } },
      orderBy: { priority: 'desc' },
      include,
    });
    // Nothing scheduled for today → surface the next pending tasks so there's
    // always a clear next action.
    if (missions.length === 0) {
      missions = await this.prisma.dailyMission.findMany({
        where: { plan: { studentId: sid }, status: MissionStatus.PENDING },
        orderBy: [{ date: 'asc' }, { priority: 'desc' }],
        take: 3,
        include,
      });
    }

    // One task per topic, max 3 — no duplicate topics in the daily view.
    const seen = new Set<string>();
    const tasks: Array<{
      missionId: string;
      topicId: string | null;
      title: string;
      subjectId: string | null;
      subjectName: string | null;
      done: boolean;
    }> = [];
    for (const m of missions) {
      const key = m.topicId ?? m.id;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      tasks.push({
        missionId: m.id,
        topicId: m.topicId,
        title: m.topic?.title ?? m.title,
        subjectId: m.topic?.subject.id ?? null,
        subjectName: m.topic?.subject.name ?? null,
        done: m.status === MissionStatus.COMPLETED,
      });
      if (tasks.length >= 3) {
        break;
      }
    }

    const streak = await this.streak.getStreak(sid);
    const activeToday = streak.lastActiveDate
      ? this.startOfDay(streak.lastActiveDate).getTime() === start.getTime()
      : false;
    const completedCount = tasks.filter((t) => t.done).length;

    return {
      goalCount: tasks.length,
      completedCount,
      allDone: tasks.length > 0 && completedCount === tasks.length,
      activeToday,
      streak: { current: streak.currentStreak, longest: streak.longestStreak },
      tasks,
    };
  }

  /** Finishing a topic check completes its mission(s) for today and extends the streak. */
  async recordTopicCompletion(studentId: string, topicIds: string[]): Promise<void> {
    if (topicIds.length === 0) {
      return;
    }
    await this.prisma.dailyMission.updateMany({
      where: { plan: { studentId }, topicId: { in: topicIds }, status: MissionStatus.PENDING },
      data: { status: MissionStatus.COMPLETED },
    });
    await this.streak.recordActivity(studentId);
  }

  async updateMission(studentId: string | undefined, missionId: string, dto: UpdateMissionDto) {
    const sid = this.requireStudent(studentId);
    const mission = await this.prisma.dailyMission.findUnique({
      where: { id: missionId },
      include: { plan: { select: { studentId: true } } },
    });
    if (!mission || mission.plan.studentId !== sid) {
      throw new NotFoundException('Mission not found');
    }

    const updated = await this.prisma.dailyMission.update({
      where: { id: missionId },
      data: { status: dto.status },
    });
    if (dto.status === MissionStatus.COMPLETED) {
      await this.streak.recordActivity(sid);
    }
    return updated;
  }

  // ─── prioritisation ───────────────────────────────────────────────────────────

  private async buildPriorities(studentId: string, grade: number): Promise<PrioritisedTopic[]> {
    const [weak, examProximity] = await Promise.all([
      this.prisma.weakTopicProfile.findMany({
        where: { studentId },
        include: {
          topic: { select: { id: true, title: true, subjectId: true, importance: true } },
        },
      }),
      this.examProximityBySubject(grade),
    ]);

    const seen = new Set<string>();
    const result: PrioritisedTopic[] = [];

    for (const w of weak) {
      seen.add(w.topicId);
      const proximity = examProximity.get(w.topic.subjectId) ?? 0;
      result.push({
        topicId: w.topicId,
        title: w.topic.title,
        subjectId: w.topic.subjectId,
        reason: this.reason(w.weaknessScore, w.topic.importance, proximity),
        priority: w.weaknessScore * 0.6 + w.topic.importance * 0.3 + proximity * 0.1,
      });
    }

    // Fall back to / supplement with important topics from enrolled subjects.
    if (result.length === 0) {
      const enrolled = await this.prisma.studentSubject.findMany({
        where: { studentId },
        select: { subjectId: true },
      });
      const subjectIds = enrolled.map((e) => e.subjectId);
      const topics = await this.prisma.topic.findMany({
        where: { subjectId: { in: subjectIds } },
        orderBy: { importance: 'desc' },
        take: 20,
        select: { id: true, title: true, subjectId: true, importance: true },
      });
      for (const t of topics) {
        if (seen.has(t.id)) {
          continue;
        }
        const proximity = examProximity.get(t.subjectId) ?? 0;
        result.push({
          topicId: t.id,
          title: t.title,
          subjectId: t.subjectId,
          reason: 'High-importance topic for upcoming revision.',
          priority: t.importance * 0.7 + proximity * 0.3,
        });
      }
    }

    return result.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Map subjectId → exam-proximity score (0..1, nearer exams score higher) for
   * the student's grade. Considers subject-specific and grade-wide exam dates.
   */
  private async examProximityBySubject(grade: number): Promise<Map<string, number>> {
    const now = new Date();
    const dates = await this.prisma.importantDate.findMany({
      where: {
        date: { gte: now },
        type: { in: [ImportantDateType.SUBJECT_EXAM, ImportantDateType.EXAM_PERIOD] },
        OR: [{ grade }, { grade: null }],
        subjectId: { not: null },
      },
      select: { subjectId: true, date: true },
    });

    const map = new Map<string, number>();
    for (const d of dates) {
      if (!d.subjectId) {
        continue;
      }
      const daysUntil = Math.max(1, Math.round((d.date.getTime() - now.getTime()) / 86_400_000));
      // Within ~60 days the score climbs toward 1 as the exam approaches.
      const score = Math.min(1, 60 / daysUntil) / 60 + (daysUntil <= 60 ? 1 - daysUntil / 60 : 0);
      const normalised = Math.max(0, Math.min(1, score));
      map.set(d.subjectId, Math.max(map.get(d.subjectId) ?? 0, normalised));
    }
    return map;
  }

  private reason(weakness: number, importance: number, proximity: number): string {
    const parts: string[] = [];
    if (weakness >= 0.5) {
      parts.push('flagged as a weak topic');
    }
    if (importance >= 0.7) {
      parts.push('high curriculum importance');
    }
    if (proximity >= 0.5) {
      parts.push('exam approaching');
    }
    return parts.length > 0
      ? `Prioritised: ${parts.join(', ')}.`
      : 'Scheduled for steady revision.';
  }

  private weekFocus(topics: PrioritisedTopic[], week: number, perDay: number): string {
    const perWeek = perDay * 7;
    const slice = topics.slice(week * perWeek, week * perWeek + 3).map((t) => t.title);
    return slice.length > 0 ? `Focus: ${slice.join(', ')}` : 'General revision';
  }

  private requireStudent(studentId: string | undefined): string {
    if (!studentId) {
      throw new ForbiddenException('Only students have a study roadmap');
    }
    return studentId;
  }

  private startOfDay(d: Date): Date {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  private addDays(d: Date, n: number): Date {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + n);
    return copy;
  }
}
