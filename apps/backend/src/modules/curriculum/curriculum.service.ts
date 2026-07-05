import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { KnowledgeSourceType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { TtlCache } from '../../common/utils/ttl-cache';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import { ImportCurriculumDto } from './dto/import-curriculum.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateTopicDto } from './dto/create-topic.dto';
import { CreateSubtopicDto } from './dto/create-subtopic.dto';
import { RegisterDocumentDto } from './dto/register-document.dto';
import { chunkText } from './ingestion/text-chunker';
import { extractPdf } from './ingestion/pdf.util';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

/**
 * Module 3 — CAPS Curriculum Engine. Owns the Grade→Subject→Topic→Subtopic
 * hierarchy plus the document ingestion pipeline that feeds the AI knowledge base.
 */
@Injectable()
export class CurriculumService {
  private readonly logger = new Logger(CurriculumService.name);
  // Subjects/topic trees are identical for every student and change only via
  // admin ingestion — cache hot reads for 10 minutes, cleared on any write.
  private readonly cache = new TtlCache<unknown>(10 * 60 * 1000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ─── Read ──────────────────────────────────────────────────────────────────

  async listSubjects(grade?: number) {
    return this.cache.getOrLoad(`subjects:${grade ?? 'all'}`, () =>
      this.prisma.subject.findMany({
        where: grade ? { grade } : undefined,
        orderBy: [{ grade: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, code: true, grade: true, weighting: true },
      }),
    );
  }

  async getSubjectTree(id: string) {
    const subject = await this.cache.getOrLoad(`tree:${id}`, () =>
      this.prisma.subject.findUnique({
        where: { id },
        include: {
          topics: {
            orderBy: { orderIndex: 'asc' },
            include: { subtopics: { orderBy: { orderIndex: 'asc' } } },
          },
        },
      }),
    );
    if (!subject) {
      throw new NotFoundException('Subject not found');
    }
    return subject;
  }

  // ─── Admin: single-entity creation ───────────────────────────────────────────

  createSubject(dto: CreateSubjectDto) {
    this.cache.clear();
    return this.prisma.subject.create({
      data: {
        name: dto.name,
        code: dto.code,
        grade: dto.grade,
        weighting: dto.weighting ?? 1,
      },
    });
  }

  async createTopic(dto: CreateTopicDto) {
    this.cache.clear();
    await this.assertExists('subject', dto.subjectId);
    return this.prisma.topic.create({
      data: {
        subjectId: dto.subjectId,
        title: dto.title,
        description: dto.description,
        orderIndex: dto.orderIndex ?? 0,
        importance: dto.importance ?? 1,
      },
    });
  }

  async createSubtopic(dto: CreateSubtopicDto) {
    this.cache.clear();
    await this.assertExists('topic', dto.topicId);
    return this.prisma.subtopic.create({
      data: { topicId: dto.topicId, title: dto.title, orderIndex: dto.orderIndex ?? 0 },
    });
  }

  // ─── Admin: structured bulk import ────────────────────────────────────────────

  /**
   * Idempotent per subject (matched on code): the subject is upserted and its
   * topic tree is fully replaced with the supplied structure.
   */
  async importCurriculum(dto: ImportCurriculumDto): Promise<{ subjects: number; topics: number }> {
    this.cache.clear();
    let topicCount = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const s of dto.subjects) {
        const subject = await tx.subject.upsert({
          where: { code: s.code },
          update: { name: s.name, grade: s.grade, weighting: s.weighting ?? 1 },
          create: { name: s.name, code: s.code, grade: s.grade, weighting: s.weighting ?? 1 },
        });
        // Replace the topic tree (cascade removes old subtopics).
        await tx.topic.deleteMany({ where: { subjectId: subject.id } });
        for (const [ti, t] of s.topics.entries()) {
          await tx.topic.create({
            data: {
              subjectId: subject.id,
              title: t.title,
              description: t.description,
              orderIndex: t.orderIndex ?? ti,
              importance: t.importance ?? 1,
              subtopics: t.subtopics
                ? {
                    create: t.subtopics.map((st, si) => ({
                      title: st.title,
                      orderIndex: st.orderIndex ?? si,
                    })),
                  }
                : undefined,
            },
          });
          topicCount += 1;
        }
      }
    });
    return { subjects: dto.subjects.length, topics: topicCount };
  }

  // ─── Document ingestion pipeline ──────────────────────────────────────────────

  /**
   * Store an uploaded curriculum file (PDF or text) and register it for ingestion.
   */
  async registerDocument(file: UploadedFile, dto: RegisterDocumentDto) {
    const ext = file.originalname.includes('.') ? file.originalname.split('.').pop() : 'bin';
    const key = `curriculum/${randomUUID()}.${ext}`;
    await this.storage.put(key, file.buffer, file.mimetype);

    return this.prisma.curriculumDocument.create({
      data: {
        title: dto.title,
        subjectCode: dto.subjectCode,
        grade: dto.grade,
        storageKey: key,
        mimeType: file.mimetype,
        ingested: false,
      },
    });
  }

  /**
   * Read a stored document, extract its text, chunk it, and persist
   * KnowledgeChunk rows. Embeddings are backfilled by the AI module (Module 5);
   * here chunks are created without vectors.
   */
  async ingestDocument(
    documentId: string,
    sourceType: KnowledgeSourceType = KnowledgeSourceType.CURRICULUM,
  ): Promise<{ chunks: number }> {
    const doc = await this.prisma.curriculumDocument.findUnique({ where: { id: documentId } });
    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    const bytes = await this.storage.get(doc.storageKey);
    let text: string;
    let pageCount: number | undefined;
    if (doc.mimeType === 'application/pdf') {
      const extracted = await extractPdf(bytes);
      text = extracted.text;
      pageCount = extracted.pageCount;
    } else {
      text = bytes.toString('utf8');
    }

    const chunks = chunkText(text);
    if (chunks.length > 0) {
      await this.prisma.knowledgeChunk.createMany({
        data: chunks.map((c) => ({
          documentId: doc.id,
          sourceType,
          subjectCode: doc.subjectCode,
          grade: doc.grade,
          content: c.content,
          tokenCount: c.tokenCount,
        })),
      });
    }

    await this.prisma.curriculumDocument.update({
      where: { id: doc.id },
      data: { ingested: true, pageCount },
    });
    this.logger.log(`Ingested document ${doc.id}: ${chunks.length} chunks`);
    return { chunks: chunks.length };
  }

  private async assertExists(model: 'subject' | 'topic', id: string): Promise<void> {
    const where = { id } as Prisma.SubjectWhereUniqueInput & Prisma.TopicWhereUniqueInput;
    const found =
      model === 'subject'
        ? await this.prisma.subject.findUnique({ where, select: { id: true } })
        : await this.prisma.topic.findUnique({ where, select: { id: true } });
    if (!found) {
      throw new NotFoundException(`${model} not found`);
    }
  }
}
