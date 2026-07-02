import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { DiagnosticService } from '../diagnostic/diagnostic.service';
import { RoadmapService } from '../roadmap/roadmap.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetSubjectsDto } from './dto/set-subjects.dto';
import { OnboardingDto, SetMarksDto } from './dto/onboarding.dto';

/** Map a student's grade to the curriculum phase grade we hold subjects at. */
export function phaseGradeFor(grade: number): number {
  return grade <= 9 ? 9 : 10; // Senior Phase (8–9) → 9; FET (10–12) → 10
}

const WEAK_MARK = 50;

/**
 * Module 2 — Student Profile. Owns the student's editable details and their
 * subject enrolment. All operations are scoped to the authenticated student.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnostic: DiagnosticService,
    private readonly roadmap: RoadmapService,
  ) {}

  private requireStudent(user: AuthenticatedUser): string {
    if (!user.studentProfileId) {
      throw new ForbiddenException('Only students have a learning profile');
    }
    return user.studentProfileId;
  }

  async getMyProfile(user: AuthenticatedUser) {
    const id = this.requireStudent(user);
    const profile = await this.prisma.studentProfile.findUnique({
      where: { id },
      include: {
        subjects: { include: { subject: true } },
        subjectMarks: { orderBy: { subjectName: 'asc' } },
      },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return {
      id: profile.id,
      firstName: profile.firstName,
      surname: profile.surname,
      email: user.email,
      grade: profile.grade,
      school: profile.school,
      province: profile.province,
      syllabus: profile.syllabus,
      onboarded: profile.onboarded,
      subjects: profile.subjects.map((s) => ({
        id: s.subject.id,
        name: s.subject.name,
        code: s.subject.code,
        grade: s.subject.grade,
      })),
      marks: profile.subjectMarks.map((m) => ({ subjectName: m.subjectName, mark: m.mark })),
    };
  }

  /**
   * Complete first-run onboarding: capture grade, syllabus and the student's
   * subjects + marks, enrol them in any matching curriculum subjects, and flag
   * the profile as onboarded.
   */
  async completeOnboarding(user: AuthenticatedUser, dto: OnboardingDto) {
    const studentId = this.requireStudent(user);
    const profile = await this.prisma.studentProfile.findUniqueOrThrow({
      where: { id: studentId },
    });
    const grade = dto.grade ?? profile.grade;
    const curriculumGrade = phaseGradeFor(grade);

    // Enrol in curriculum subjects that match the chosen subjects by name, within
    // the student's phase (Senior Phase 8–9 → grade-9 set; FET 10–12 → grade-10 set).
    const names = dto.subjects.map((s) => s.subjectName);
    const curriculumSubjects = await this.prisma.subject.findMany({
      where: { grade: curriculumGrade, name: { in: names } },
      select: { id: true, name: true },
    });

    await this.prisma.$transaction([
      this.prisma.studentProfile.update({
        where: { id: studentId },
        data: { grade, syllabus: dto.syllabus, onboarded: true },
      }),
      this.prisma.subjectMark.deleteMany({ where: { studentId } }),
      this.prisma.subjectMark.createMany({
        data: dto.subjects.map((s) => ({ studentId, subjectName: s.subjectName, mark: s.mark })),
      }),
      this.prisma.studentSubject.deleteMany({ where: { studentId } }),
      this.prisma.studentSubject.createMany({
        data: curriculumSubjects.map((s) => ({ studentId, subjectId: s.id })),
        skipDuplicates: true,
      }),
    ]);

    // For every subject the student is weak in (mark < 50%), build a short
    // diagnostic to find exactly where they are. Subjects without a question bank
    // yet are skipped silently.
    const diagnostics = await this.createWeakSubjectDiagnostics(dto.subjects, curriculumSubjects);

    // Build the student's initial "road to success" from their syllabus topics.
    // It starts importance-ordered and is refined as diagnostics reveal weak areas.
    let roadmapGenerated = false;
    try {
      await this.roadmap.generate(studentId, {});
      roadmapGenerated = true;
    } catch {
      // No topics yet (e.g. subjects without a syllabus) — skip silently.
    }

    const result = await this.getMyProfile(user);
    return { ...result, diagnostics, roadmapGenerated };
  }

  private async createWeakSubjectDiagnostics(
    inputs: Array<{ subjectName: string; mark: number }>,
    enrolled: Array<{ id: string; name: string }>,
  ): Promise<Array<{ testId: string; subjectId: string; subjectName: string; questionCount: number }>> {
    const created: Array<{ testId: string; subjectId: string; subjectName: string; questionCount: number }> = [];
    for (const subject of enrolled) {
      const mark = inputs.find((s) => s.subjectName === subject.name)?.mark;
      if (mark === undefined || mark >= WEAK_MARK) {
        continue;
      }
      try {
        const test = await this.diagnostic.generate({ subjectId: subject.id, questionCount: 8 });
        created.push({
          testId: test.id,
          subjectId: subject.id,
          subjectName: subject.name,
          questionCount: test.questionCount,
        });
      } catch {
        // No question bank for this subject yet — skip.
      }
    }
    return created;
  }

  async getMarks(user: AuthenticatedUser) {
    const studentId = this.requireStudent(user);
    const marks = await this.prisma.subjectMark.findMany({
      where: { studentId },
      orderBy: { subjectName: 'asc' },
    });
    return marks.map((m) => ({ subjectName: m.subjectName, mark: m.mark }));
  }

  async setMarks(user: AuthenticatedUser, dto: SetMarksDto) {
    const studentId = this.requireStudent(user);
    await this.prisma.$transaction([
      this.prisma.subjectMark.deleteMany({ where: { studentId } }),
      this.prisma.subjectMark.createMany({
        data: dto.subjects.map((s) => ({ studentId, subjectName: s.subjectName, mark: s.mark })),
      }),
    ]);
    return this.getMarks(user);
  }

  async updateMyProfile(user: AuthenticatedUser, dto: UpdateProfileDto) {
    const id = this.requireStudent(user);
    await this.prisma.studentProfile.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        surname: dto.surname,
        grade: dto.grade,
        school: dto.school,
        province: dto.province,
      },
    });
    return this.getMyProfile(user);
  }

  /**
   * Replace the student's subject enrolment with the given set. Validates that
   * every subject exists and matches the student's grade.
   */
  async setSubjects(user: AuthenticatedUser, dto: SetSubjectsDto) {
    const studentId = this.requireStudent(user);
    const profile = await this.prisma.studentProfile.findUniqueOrThrow({
      where: { id: studentId },
    });

    const subjects = await this.prisma.subject.findMany({
      where: { id: { in: dto.subjectIds } },
      select: { id: true, grade: true },
    });
    if (subjects.length !== dto.subjectIds.length) {
      throw new BadRequestException('One or more subjects do not exist');
    }
    const curriculumGrade = phaseGradeFor(profile.grade);
    const mismatched = subjects.filter((s) => s.grade !== curriculumGrade);
    if (mismatched.length > 0) {
      throw new BadRequestException(`Subjects are not valid for grade ${profile.grade}`);
    }

    await this.prisma.$transaction([
      this.prisma.studentSubject.deleteMany({ where: { studentId } }),
      this.prisma.studentSubject.createMany({
        data: dto.subjectIds.map((subjectId) => ({ studentId, subjectId })),
      }),
    ]);
    return this.getMyProfile(user);
  }
}
