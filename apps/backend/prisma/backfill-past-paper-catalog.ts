import 'dotenv/config';
import { KnowledgeSourceType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const run = process.env.PAPER_CATALOG_RUN === '1';

function canonicalSubjectCode(code: string | null, grade: number): string | null {
  if (!code) return null;
  const normalised = code.replace(/^ENG-FAL-/, 'ENFAL-');
  return /-G\d+$/.test(normalised)
    ? normalised.replace(/-G\d+$/, `-G${grade}`)
    : `${normalised}-G${grade}`;
}

function inferYear(value: string): number | null {
  const match = value.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function inferKind(value: string, sourceTypes: KnowledgeSourceType[]): string {
  const lower = value.toLowerCase();
  const memo =
    sourceTypes.includes(KnowledgeSourceType.MARKING_GUIDE) ||
    /\b(memo|memorandum|marking guideline|marking guide|mg)\b/.test(lower);
  if (memo) return 'Memo';
  if (/\b(paper|p)\s*1\b/.test(lower)) return 'Paper 1';
  if (/\b(paper|p)\s*2\b/.test(lower)) return 'Paper 2';
  if (/\b(paper|p)\s*3\b/.test(lower)) return 'Paper 3';
  return 'Question Paper';
}

async function main(): Promise<void> {
  const documents = await prisma.curriculumDocument.findMany({
    where: {
      knowledgeChunks: {
        some: {
          sourceType: {
            in: [KnowledgeSourceType.PAST_PAPER, KnowledgeSourceType.MARKING_GUIDE],
          },
        },
      },
    },
    include: {
      knowledgeChunks: {
        distinct: ['sourceType'],
        select: { sourceType: true },
      },
    },
    orderBy: [{ grade: 'asc' }, { title: 'asc' }],
  });

  const subjects = await prisma.subject.findMany({
    select: { id: true, code: true },
  });
  const subjectByCode = new Map(subjects.map((subject) => [subject.code, subject.id]));

  let ready = 0;
  let skipped = 0;
  for (const document of documents) {
    if (!document.grade) {
      console.warn(`SKIP no grade: ${document.title}`);
      skipped += 1;
      continue;
    }
    const combined = `${document.title} ${document.storageKey}`;
    const year = inferYear(combined);
    if (!year) {
      console.warn(`SKIP no year: ${document.title}`);
      skipped += 1;
      continue;
    }
    const code = canonicalSubjectCode(document.subjectCode, document.grade);
    const subjectId = code ? subjectByCode.get(code) : undefined;
    const kind = inferKind(
      combined,
      document.knowledgeChunks.map((chunk) => chunk.sourceType),
    );
    const id = `catalog-${document.id}`;

    if (run) {
      await prisma.pastPaper.upsert({
        where: { id },
        update: {
          title: document.title,
          subjectId,
          grade: document.grade,
          year,
          kind,
          storageKey: document.storageKey,
          mimeType: document.mimeType,
        },
        create: {
          id,
          title: document.title,
          subjectId,
          grade: document.grade,
          year,
          kind,
          storageKey: document.storageKey,
          mimeType: document.mimeType,
        },
      });
    } else if (ready < 25) {
      console.log(
        `${document.grade} ${String(year)} ${String(code ?? 'NO-SUBJECT').padEnd(14)} ${kind.padEnd(14)} ${document.title}`,
      );
    }
    ready += 1;
  }

  console.log(
    run
      ? `catalogued ${ready} papers; skipped ${skipped}`
      : `dry run: ${ready} papers ready; ${skipped} skipped. Set PAPER_CATALOG_RUN=1 to write.`,
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
