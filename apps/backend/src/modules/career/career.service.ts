import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateCareerDto } from './dto/create-career.dto';
import { MatchCareersDto } from './dto/match-careers.dto';
import { computeAps } from './aps';

export interface CareerMatchResult {
  careerId: string;
  title: string;
  description: string;
  faculty: string | null;
  eligible: boolean;
  admissionLikelihood: number;
  computedAps: number;
  unmetSubjects: string[];
  programmes: Array<{
    university: string;
    programmeName: string;
    minAps: number;
    apsMet: boolean;
    requirementsMet: boolean;
  }>;
}

/**
 * Module 12 — Career Guidance. Computes APS from a student's marks, evaluates
 * eligibility and admission likelihood against the career database, and stores
 * the result.
 */
@Injectable()
export class CareerService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Admin: career database ───────────────────────────────────────────────────

  createCareer(dto: CreateCareerDto) {
    return this.prisma.career.create({
      data: {
        title: dto.title,
        description: dto.description,
        subjectRequirements: dto.subjectRequirements
          ? { create: dto.subjectRequirements }
          : undefined,
        programmes: dto.programmes
          ? {
              create: dto.programmes.map((p) => ({
                university: p.university,
                programmeName: p.programmeName,
                minAps: p.minAps,
                requirements: p.requirements ? { create: p.requirements } : undefined,
              })),
            }
          : undefined,
      },
      include: { subjectRequirements: true, programmes: { include: { requirements: true } } },
    });
  }

  listCareers() {
    return this.prisma.career.findMany({
      orderBy: { title: 'asc' },
      include: { subjectRequirements: true, programmes: true },
    });
  }

  async getCareer(id: string) {
    const career = await this.prisma.career.findUnique({
      where: { id },
      include: { subjectRequirements: true, programmes: { include: { requirements: true } } },
    });
    if (!career) {
      throw new NotFoundException('Career not found');
    }
    return career;
  }

  // ─── Matching ─────────────────────────────────────────────────────────────────

  async match(studentId: string | undefined, dto: MatchCareersDto): Promise<CareerMatchResult[]> {
    if (!studentId) {
      throw new ForbiddenException('Only students can match careers');
    }
    return this.computeMatches(studentId, dto.marks);
  }

  /**
   * Recommend careers from the student's stored subjects + marks (set at
   * onboarding / editable on the careers screen). Returns the best-fit first.
   */
  async recommended(studentId: string | undefined, limit = 200): Promise<CareerMatchResult[]> {
    if (!studentId) {
      throw new ForbiddenException('Only students can get recommendations');
    }
    const marks = await this.prisma.subjectMark.findMany({ where: { studentId } });
    if (marks.length === 0) {
      return [];
    }
    const results = await this.computeMatches(
      studentId,
      marks.map((m) => ({ subjectName: m.subjectName, percent: m.mark })),
    );
    return results.slice(0, limit);
  }

  private async computeMatches(
    studentId: string,
    marksInput: Array<{ subjectName: string; percent: number }>,
  ): Promise<CareerMatchResult[]> {
    const aps = computeAps(marksInput);
    const markBySubject = new Map(marksInput.map((m) => [this.norm(m.subjectName), m.percent]));

    const careers = await this.prisma.career.findMany({
      include: { subjectRequirements: true, programmes: { include: { requirements: true } } },
    });

    const results: CareerMatchResult[] = careers.map((career) => {
      const unmet = career.subjectRequirements.filter(
        (r) => (markBySubject.get(this.norm(r.subjectName)) ?? -1) < r.minPercent,
      );
      const subjectsMet = career.subjectRequirements.length - unmet.length;
      const subjectRatio =
        career.subjectRequirements.length > 0 ? subjectsMet / career.subjectRequirements.length : 1;

      const programmes = career.programmes.map((p) => {
        const apsMet = aps >= p.minAps;
        const reqUnmet = p.requirements.filter(
          (r) => (markBySubject.get(this.norm(r.subjectName)) ?? -1) < r.minPercent,
        );
        return {
          university: p.university,
          programmeName: p.programmeName,
          minAps: p.minAps,
          apsMet,
          requirementsMet: reqUnmet.length === 0,
        };
      });

      const eligible = unmet.length === 0 && programmes.some((p) => p.apsMet && p.requirementsMet);
      const bestApsFactor =
        programmes.length > 0
          ? Math.max(...programmes.map((p) => Math.min(1, p.minAps > 0 ? aps / p.minAps : 1)))
          : Math.min(1, aps / 30);
      const likelihood = Math.round((subjectRatio * 0.5 + bestApsFactor * 0.5) * 100) / 100;

      return {
        careerId: career.id,
        title: career.title,
        description: career.description,
        faculty: career.faculty,
        eligible,
        admissionLikelihood: likelihood,
        computedAps: aps,
        unmetSubjects: unmet.map((u) => u.subjectName),
        programmes,
      };
    });

    const sorted = results.sort((a, b) => b.admissionLikelihood - a.admissionLikelihood);

    // Persist only the strongest matches for the student's record — best-effort,
    // batched into one transaction so it uses a single connection/round-trip
    // instead of twelve parallel ones.
    try {
      await this.prisma.$transaction(
        sorted.slice(0, 12).map((r) =>
          this.prisma.careerMatch.upsert({
            where: { studentId_careerId: { studentId, careerId: r.careerId } },
            update: { eligible: r.eligible, admissionLikelihood: r.admissionLikelihood, computedAps: r.computedAps },
            create: { studentId, careerId: r.careerId, eligible: r.eligible, admissionLikelihood: r.admissionLikelihood, computedAps: r.computedAps },
          }),
        ),
      );
    } catch {
      // Recommendations still return even if the record write hiccups.
    }

    return sorted;
  }

  private norm(s: string): string {
    return s.trim().toLowerCase();
  }
}
