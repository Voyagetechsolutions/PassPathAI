import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ImportantDateType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateExamDateDto } from './dto/create-exam-date.dto';

const ymd = (d: Date): string => d.toISOString().slice(0, 10);

export interface LearnedDay {
  date: string;
  topics: Array<{ topicId: string; title: string; subjectName: string }>;
}
export interface CalendarExam {
  id: string;
  date: string;
  title: string;
  subjectName: string | null;
  editable: boolean;
}

/**
 * The student's calendar — what they learnt on each day, plus their exams. Powers
 * the home "Calendar" quick action: a record of progress and a countdown to exams.
 */
@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  private requireStudent(studentId: string | undefined): string {
    if (!studentId) {
      throw new ForbiddenException('Only students have a calendar');
    }
    return studentId;
  }

  /** Everything the calendar screen needs for one month (YYYY-MM). */
  async month(studentId: string | undefined, monthStr?: string) {
    const sid = this.requireStudent(studentId);
    const { start, end, label } = this.monthRange(monthStr);

    const profile = await this.prisma.studentProfile.findUnique({ where: { id: sid }, select: { grade: true } });

    const [tutorMessages, studentExams, nationalExams] = await Promise.all([
      // What was learnt: each tutor reply marks engagement with that topic that day.
      this.prisma.tutorMessage.findMany({
        where: { role: 'assistant', createdAt: { gte: start, lt: end }, conversation: { studentId: sid } },
        select: {
          createdAt: true,
          conversation: { select: { topic: { select: { id: true, title: true, subject: { select: { name: true } } } } } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.studentExamDate.findMany({
        where: { studentId: sid, date: { gte: start, lt: end } },
        select: { id: true, date: true, title: true, subject: { select: { name: true } } },
        orderBy: { date: 'asc' },
      }),
      this.prisma.importantDate.findMany({
        where: {
          date: { gte: start, lt: end },
          type: { in: [ImportantDateType.EXAM_PERIOD, ImportantDateType.SUBJECT_EXAM] },
          OR: [{ grade: null }, { grade: profile?.grade ?? -1 }],
        },
        select: { id: true, date: true, title: true, subject: { select: { name: true } } },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Group learnt topics by day, de-duplicating repeated topics within a day.
    const byDay = new Map<string, Map<string, { topicId: string; title: string; subjectName: string }>>();
    for (const m of tutorMessages) {
      const t = m.conversation.topic;
      const day = ymd(m.createdAt);
      if (!byDay.has(day)) byDay.set(day, new Map());
      byDay.get(day)!.set(t.id, { topicId: t.id, title: t.title, subjectName: t.subject.name });
    }
    const learned: LearnedDay[] = [...byDay.entries()]
      .map(([date, topics]) => ({ date, topics: [...topics.values()] }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const exams: CalendarExam[] = [
      ...studentExams.map((e) => ({ id: e.id, date: ymd(e.date), title: e.title, subjectName: e.subject?.name ?? null, editable: true })),
      ...nationalExams.map((e) => ({ id: e.id, date: ymd(e.date), title: e.title, subjectName: e.subject?.name ?? null, editable: false })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    return { month: label, learned, exams };
  }

  /** Add an exam date the student is preparing for. */
  async addExam(studentId: string | undefined, dto: CreateExamDateDto) {
    const sid = this.requireStudent(studentId);
    const date = new Date(dto.date);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    const created = await this.prisma.studentExamDate.create({
      data: { studentId: sid, title: dto.title.trim(), date, subjectId: dto.subjectId || null },
      select: { id: true, date: true, title: true, subject: { select: { name: true } } },
    });
    return { id: created.id, date: ymd(created.date), title: created.title, subjectName: created.subject?.name ?? null, editable: true };
  }

  /** Remove an exam the student added (ownership enforced). */
  async removeExam(studentId: string | undefined, id: string) {
    const sid = this.requireStudent(studentId);
    const existing = await this.prisma.studentExamDate.findFirst({ where: { id, studentId: sid } });
    if (!existing) {
      throw new NotFoundException('Exam date not found');
    }
    await this.prisma.studentExamDate.delete({ where: { id } });
    return { removed: true };
  }

  private monthRange(monthStr?: string): { start: Date; end: Date; label: string } {
    const now = new Date();
    let year = now.getUTCFullYear();
    let month = now.getUTCMonth(); // 0-indexed
    if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
      const [y, m] = monthStr.split('-').map(Number);
      year = y;
      month = m - 1;
    }
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 1));
    const label = `${year}-${String(month + 1).padStart(2, '0')}`;
    return { start, end, label };
  }
}
