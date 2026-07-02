/* eslint-disable @typescript-eslint/no-explicit-any */
import { ForbiddenException } from '@nestjs/common';
import { CareerService } from './career.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { apsPointsFor, computeAps } from './aps';

describe('APS calculation', () => {
  it('maps percentages to achievement levels', () => {
    expect(apsPointsFor(85)).toBe(7);
    expect(apsPointsFor(72)).toBe(6);
    expect(apsPointsFor(50)).toBe(4);
    expect(apsPointsFor(10)).toBe(1);
  });

  it('sums the best six subjects', () => {
    const marks = [90, 90, 90, 90, 90, 90, 10].map((percent) => ({ percent }));
    expect(computeAps(marks)).toBe(42); // 6 × 7, the low mark excluded
  });
});

describe('CareerService.match', () => {
  let service: CareerService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      career: { findMany: jest.fn() },
      careerMatch: { upsert: jest.fn().mockResolvedValue({}) },
    };
    service = new CareerService(prisma as unknown as PrismaService);
  });

  it('rejects non-students', async () => {
    await expect(
      service.match(undefined, { marks: [{ subjectName: 'Maths', percent: 70 }] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('marks a career eligible when subjects and APS are met', async () => {
    prisma.career.findMany.mockResolvedValue([
      {
        id: 'c1',
        title: 'Civil Engineer',
        description: '...',
        subjectRequirements: [{ subjectName: 'Mathematics', minPercent: 70 }],
        programmes: [
          {
            university: 'UCT',
            programmeName: 'BSc Civil Eng',
            minAps: 30,
            requirements: [{ subjectName: 'Mathematics', minPercent: 70 }],
          },
        ],
      },
    ]);

    const [result] = await service.match('sp1', {
      marks: [
        { subjectName: 'Mathematics', percent: 80 },
        { subjectName: 'Physical Sciences', percent: 75 },
        { subjectName: 'English', percent: 70 },
        { subjectName: 'Life Sciences', percent: 65 },
        { subjectName: 'Geography', percent: 60 },
        { subjectName: 'Accounting', percent: 55 },
      ],
    });

    expect(result.eligible).toBe(true);
    expect(result.unmetSubjects).toHaveLength(0);
    expect(result.programmes[0].apsMet).toBe(true);
    expect(prisma.careerMatch.upsert).toHaveBeenCalledTimes(1);
  });

  it('flags unmet subjects and marks ineligible', async () => {
    prisma.career.findMany.mockResolvedValue([
      {
        id: 'c1',
        title: 'Doctor',
        description: '...',
        subjectRequirements: [{ subjectName: 'Mathematics', minPercent: 80 }],
        programmes: [],
      },
    ]);

    const [result] = await service.match('sp1', {
      marks: [{ subjectName: 'Mathematics', percent: 55 }],
    });

    expect(result.eligible).toBe(false);
    expect(result.unmetSubjects).toContain('Mathematics');
  });
});
