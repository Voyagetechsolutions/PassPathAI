import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ProfileService } from './profile.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DiagnosticService } from '../diagnostic/diagnostic.service';
import { RoadmapService } from '../roadmap/roadmap.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

describe('ProfileService', () => {
  let service: ProfileService;
  let prisma: {
    studentProfile: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock };
    subject: { findMany: jest.Mock };
    studentSubject: { deleteMany: jest.Mock; createMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const student: AuthenticatedUser = {
    id: 'u1',
    uid: 'fb1',
    email: 'thabo@example.com',
    role: Role.student,
    emailVerified: true,
    studentProfileId: 'sp1',
  };
  const parent: AuthenticatedUser = { ...student, role: Role.parent, studentProfileId: undefined };

  beforeEach(() => {
    prisma = {
      studentProfile: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
      subject: { findMany: jest.fn() },
      studentSubject: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const diagnostic = { generate: jest.fn() };
    const roadmap = { generate: jest.fn() };
    service = new ProfileService(
      prisma as unknown as PrismaService,
      diagnostic as unknown as DiagnosticService,
      roadmap as unknown as RoadmapService,
    );
  });

  it('rejects non-students', async () => {
    await expect(service.getMyProfile(parent)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns the profile with mapped subjects', async () => {
    prisma.studentProfile.findUnique.mockResolvedValue({
      id: 'sp1',
      firstName: 'Thabo',
      surname: 'Mokoena',
      grade: 10,
      school: null,
      province: null,
      subjects: [{ subject: { id: 's1', name: 'Mathematics', code: 'MATH-G10', grade: 10 } }],
      subjectMarks: [{ subjectName: 'Mathematics', mark: 72 }],
    });
    const result = await service.getMyProfile(student);
    expect(result.subjects).toHaveLength(1);
    expect(result.subjects[0].code).toBe('MATH-G10');
    expect(result.email).toBe('thabo@example.com');
  });

  it('rejects subjects that do not match the student grade', async () => {
    prisma.studentProfile.findUniqueOrThrow.mockResolvedValue({ id: 'sp1', grade: 10 });
    prisma.subject.findMany.mockResolvedValue([{ id: 's1', grade: 11 }]);
    await expect(service.setSubjects(student, { subjectIds: ['s1'] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects unknown subject ids', async () => {
    prisma.studentProfile.findUniqueOrThrow.mockResolvedValue({ id: 'sp1', grade: 10 });
    prisma.subject.findMany.mockResolvedValue([]); // none found
    await expect(service.setSubjects(student, { subjectIds: ['missing'] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
