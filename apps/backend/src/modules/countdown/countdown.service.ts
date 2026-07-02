import { ForbiddenException, Injectable } from '@nestjs/common';
import { ImportantDateType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateImportantDateDto } from './dto/create-important-date.dto';

export interface CountdownEntry {
  id: string;
  type: ImportantDateType;
  title: string;
  date: Date;
  daysRemaining: number;
  subject?: { id: string; name: string } | null;
}

export interface CountdownView {
  yearEnd: { date: Date; daysRemaining: number };
  nextExam: CountdownEntry | null;
  matricFinals: { date: Date; daysRemaining: number; year: number };
  exams: CountdownEntry[];
}

/**
 * Module 11 — Countdown System. Surfaces days until year-end and upcoming exam
 * dates (grade-wide and subject-specific) for the student's grade.
 */
@Injectable()
export class CountdownService {
  constructor(private readonly prisma: PrismaService) {}

  createDate(dto: CreateImportantDateDto) {
    return this.prisma.importantDate.create({
      data: {
        type: dto.type,
        title: dto.title,
        date: new Date(dto.date),
        subjectId: dto.subjectId,
        grade: dto.grade,
      },
    });
  }

  listDates() {
    return this.prisma.importantDate.findMany({
      orderBy: { date: 'asc' },
      include: { subject: { select: { id: true, name: true } } },
    });
  }

  async getForStudent(studentId: string | undefined): Promise<CountdownView> {
    if (!studentId) {
      throw new ForbiddenException('Only students have countdowns');
    }
    const profile = await this.prisma.studentProfile.findUniqueOrThrow({
      where: { id: studentId },
      select: { grade: true },
    });
    return this.getForGrade(profile.grade);
  }

  async getForGrade(grade: number): Promise<CountdownView> {
    const now = new Date();

    const examRows = await this.prisma.importantDate.findMany({
      where: {
        date: { gte: now },
        type: { in: [ImportantDateType.SUBJECT_EXAM, ImportantDateType.EXAM_PERIOD] },
        OR: [{ grade }, { grade: null }],
      },
      orderBy: { date: 'asc' },
      include: { subject: { select: { id: true, name: true } } },
    });

    const exams: CountdownEntry[] = examRows.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      date: e.date,
      daysRemaining: this.daysBetween(now, e.date),
      subject: e.subject,
    }));

    return {
      yearEnd: await this.resolveYearEnd(now),
      nextExam: exams[0] ?? null,
      matricFinals: this.matricFinals(now, grade),
      exams,
    };
  }

  /**
   * The NSC final ("matric") exams the student is working towards: November of
   * the year they reach Grade 12. NSC finals run Oct–Nov; we use 1 November.
   */
  private matricFinals(
    now: Date,
    grade: number,
  ): { date: Date; daysRemaining: number; year: number } {
    const yearsToMatric = Math.max(0, 12 - grade);
    const year = now.getFullYear() + yearsToMatric;
    const date = new Date(year, 10, 1, 8, 0, 0); // 1 November
    return { date, daysRemaining: this.daysBetween(now, date), year };
  }

  /** Use a configured YEAR_END date if present, else 31 December of this year. */
  private async resolveYearEnd(now: Date): Promise<{ date: Date; daysRemaining: number }> {
    const configured = await this.prisma.importantDate.findFirst({
      where: { type: ImportantDateType.YEAR_END, date: { gte: now } },
      orderBy: { date: 'asc' },
    });
    const date = configured?.date ?? new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    return { date, daysRemaining: this.daysBetween(now, date) };
  }

  private daysBetween(from: Date, to: Date): number {
    return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86_400_000));
  }
}
