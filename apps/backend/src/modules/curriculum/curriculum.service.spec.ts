/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotFoundException } from '@nestjs/common';
import { KnowledgeSourceType } from '@prisma/client';
import { CurriculumService, UploadedFile } from './curriculum.service';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';

describe('CurriculumService', () => {
  let service: CurriculumService;
  let prisma: any;
  let storage: { put: jest.Mock; get: jest.Mock };

  beforeEach(() => {
    prisma = {
      subject: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), upsert: jest.fn() },
      topic: { deleteMany: jest.fn(), create: jest.fn() },
      curriculumDocument: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      knowledgeChunk: { createMany: jest.fn() },
      $transaction: jest.fn(),
    };
    storage = { put: jest.fn().mockResolvedValue({ key: 'k', url: 'u' }), get: jest.fn() };
    service = new CurriculumService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
    );
  });

  describe('getSubjectTree', () => {
    it('throws when the subject is missing', async () => {
      prisma.subject.findUnique.mockResolvedValue(null);
      await expect(service.getSubjectTree('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('importCurriculum', () => {
    it('upserts subjects and replaces their topic trees', async () => {
      const tx = {
        subject: { upsert: jest.fn().mockResolvedValue({ id: 'subj1' }) },
        topic: { deleteMany: jest.fn(), create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(async (cb: (t: typeof tx) => Promise<void>) => cb(tx));

      const result = await service.importCurriculum({
        subjects: [
          {
            name: 'Mathematics',
            code: 'MATH-G10',
            grade: 10,
            topics: [
              { title: 'Algebra', subtopics: [{ title: 'Factorisation' }] },
              { title: 'Geometry' },
            ],
          },
        ],
      });

      expect(tx.subject.upsert).toHaveBeenCalledTimes(1);
      expect(tx.topic.deleteMany).toHaveBeenCalledWith({ where: { subjectId: 'subj1' } });
      expect(tx.topic.create).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ subjects: 1, topics: 2 });
    });
  });

  describe('ingestDocument', () => {
    it('chunks a text document into knowledge chunks', async () => {
      prisma.curriculumDocument.findUnique.mockResolvedValue({
        id: 'doc1',
        storageKey: 'k',
        mimeType: 'text/plain',
        subjectCode: 'MATH-G10',
        grade: 10,
      });
      storage.get.mockResolvedValue(Buffer.from('Algebra basics.\n\nFactorisation rules.'));

      const result = await service.ingestDocument('doc1');

      expect(result.chunks).toBeGreaterThan(0);
      const createArg = prisma.knowledgeChunk.createMany.mock.calls[0][0];
      expect(createArg.data[0].sourceType).toBe(KnowledgeSourceType.CURRICULUM);
      expect(prisma.curriculumDocument.update).toHaveBeenCalledWith({
        where: { id: 'doc1' },
        data: { ingested: true, pageCount: undefined },
      });
    });

    it('throws when the document is missing', async () => {
      prisma.curriculumDocument.findUnique.mockResolvedValue(null);
      await expect(service.ingestDocument('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('registerDocument', () => {
    it('stores the file and creates a document record', async () => {
      prisma.curriculumDocument.create.mockResolvedValue({ id: 'doc1' });
      const file: UploadedFile = {
        originalname: 'caps.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF'),
      };
      await service.registerDocument(file, {
        title: 'CAPS Maths',
        subjectCode: 'MATH-G10',
        grade: 10,
      });
      expect(storage.put).toHaveBeenCalledTimes(1);
      expect(prisma.curriculumDocument.create).toHaveBeenCalledTimes(1);
    });
  });
});
