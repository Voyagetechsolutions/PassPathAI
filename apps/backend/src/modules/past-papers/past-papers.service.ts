import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { UploadPastPaperDto } from './dto/upload-past-paper.dto';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

/**
 * Past papers + memos. Files live behind the storage abstraction; the public
 * file endpoint streams the bytes back (works with both the local and S3 drivers).
 */
@Injectable()
export class PastPapersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(filters: { grade?: number; subjectId?: string; studentId?: string }) {
    // When a studentId is given (and no explicit subject), restrict to the past
    // papers for the subjects that student actually takes.
    let subjectIdFilter: string | { in: string[] } | undefined = filters.subjectId;
    if (filters.studentId && !filters.subjectId) {
      const enrolled = await this.prisma.studentSubject.findMany({
        where: { studentId: filters.studentId },
        select: { subjectId: true },
      });
      subjectIdFilter = { in: enrolled.map((e) => e.subjectId) };
    }
    const papers = await this.prisma.pastPaper.findMany({
      where: { grade: filters.grade, subjectId: subjectIdFilter },
      orderBy: [{ year: 'desc' }, { title: 'asc' }],
      include: { subject: { select: { id: true, name: true } } },
    });
    return papers.map((p) => ({
      id: p.id,
      title: p.title,
      grade: p.grade,
      year: p.year,
      kind: p.kind,
      mimeType: p.mimeType,
      subject: p.subject,
      fileUrl: `/past-papers/${p.id}/file`,
    }));
  }

  async upload(file: UploadedFile, dto: UploadPastPaperDto) {
    const ext = file.originalname.includes('.') ? file.originalname.split('.').pop() : 'bin';
    const key = `pastpapers/${randomUUID()}.${ext}`;
    await this.storage.put(key, file.buffer, file.mimetype);
    return this.prisma.pastPaper.create({
      data: {
        title: dto.title,
        subjectId: dto.subjectId,
        grade: dto.grade,
        year: dto.year,
        kind: dto.kind,
        storageKey: key,
        mimeType: file.mimetype,
      },
    });
  }

  async getFile(id: string): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    const paper = await this.prisma.pastPaper.findUnique({ where: { id } });
    if (!paper) {
      throw new NotFoundException('Past paper not found');
    }
    const buffer = await this.storage.get(paper.storageKey);
    const ext = paper.storageKey.includes('.') ? paper.storageKey.split('.').pop() : 'bin';
    const safeName = paper.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    return { buffer, mimeType: paper.mimeType, filename: `${safeName}.${ext}` };
  }
}
