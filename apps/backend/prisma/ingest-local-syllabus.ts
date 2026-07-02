import { KnowledgeSourceType, PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { extractPdf } from '../src/modules/curriculum/ingestion/pdf.util';
import { chunkText } from '../src/modules/curriculum/ingestion/text-chunker';
import { withDbRetry } from '../src/common/utils/db-retry';

/**
 * Ingest the Grade 12 syllabus / Annual Teaching Plan / Exam Guideline PDFs sitting
 * in storage/grade 12 syllabus/*.pdf. Unlike ingest-caps-docs.ts (one doc per
 * subject), several files here cover the same subject (ATP + Exam Guideline) —
 * each is ingested as its own CurriculumDocument so no grounding material is lost.
 *
 *   npm run db:ingest:local-syllabus            → DRY RUN
 *   SYLLABUS_RUN=1 npm run db:ingest:local-syllabus   → actually ingest
 *   SYLLABUS_FORCE=1 ...                              → re-ingest even if already done
 */
const prisma = new PrismaClient();
const STORAGE_DIR = process.env.STORAGE_LOCAL_DIR ?? './storage';
const BASE_DIR = path.join(STORAGE_DIR, 'grade 12 syllabus');
const RUN = process.env.SYLLABUS_RUN === '1';
const FORCE = process.env.SYLLABUS_FORCE === '1';
const GRADE = 12;

// Same canonical codes as ingest-local-pastpapers.ts, plus subjects that only
// appear here (no past papers supplied for them).
const SUBJECT_MAP: Array<[string, string]> = [
  ['english fal', 'ENFAL-G10'],
  ['english hl', 'ENG-HL-G10'],
  ['computer applications', 'CAT-G10'],
  ['mathematical literacy', 'MLIT-G10'],
  ['mathematics', 'MATH-G10'],
  ['maths', 'MATH-G10'],
  ['physical science', 'PHSC-G10'],
  ['life science', 'LIFE-G10'],
  ['life orientation', 'LFOR-G10'],
  ['geography', 'GEOG-G10'],
  ['history', 'HIST-G10'],
  ['accounting', 'ACCN-G10'],
  ['business studies', 'BSTD-G10'],
  ['economics', 'ECON-G10'],
  ['tourism', 'TOUR-G10'],
];

function matchSubject(filename: string): string | null {
  // Normalise separators — some filenames use hyphens/underscores instead of
  // spaces (e.g. "GP-English-FAL-Garde-12-ATP.pdf", "KZN-Life-Sciences-...").
  const lower = filename.toLowerCase().replace(/[-_]/g, ' ');
  for (const [kw, code] of SUBJECT_MAP) {
    if (lower.includes(kw)) return code;
  }
  return null;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

async function main(): Promise<void> {
  if (!fs.existsSync(BASE_DIR)) {
    // eslint-disable-next-line no-console
    console.log(`No such folder: ${BASE_DIR}`);
    return;
  }
  const files = fs.readdirSync(BASE_DIR).filter((f) => f.toLowerCase().endsWith('.pdf'));
  // eslint-disable-next-line no-console
  console.log(`Found ${files.length} syllabus PDFs.\n`);

  let unmatched = 0;
  let ingested = 0;
  let skippedExisting = 0;
  let chunksMade = 0;

  for (const filename of files) {
    const subjectCode = matchSubject(filename);
    if (!subjectCode) {
      unmatched += 1;
      // eslint-disable-next-line no-console
      console.log(`UNMATCHED: ${filename}`);
      continue;
    }

    const id = `syl-local-${slug(filename)}`;
    const storageKey = path.join('grade 12 syllabus', filename);

    if (!RUN) {
      // eslint-disable-next-line no-console
      console.log(`${subjectCode.padEnd(12)} ${filename}`);
      continue;
    }

    try {
      const existing = await withDbRetry(() => prisma.curriculumDocument.findUnique({ where: { id } }));
      if (existing?.ingested && !FORCE) {
        skippedExisting += 1;
        continue;
      }

      const subject = await withDbRetry(() => prisma.subject.findUnique({ where: { code: subjectCode } }));
      const title = `${subject?.name ?? subjectCode} — ${filename.replace(/\.pdf$/i, '')}`;

      const bytes = fs.readFileSync(path.join(BASE_DIR, filename));
      const { text, pageCount } = await extractPdf(bytes);
      const chunks = chunkText(text);
      if (chunks.length === 0) {
        // eslint-disable-next-line no-console
        console.log(`SKIP (no text): ${filename}`);
        continue;
      }

      const doc = await withDbRetry(() =>
        prisma.curriculumDocument.upsert({
          where: { id },
          update: { title, subjectCode, grade: GRADE, ingested: true, pageCount },
          create: { id, title, subjectCode, grade: GRADE, storageKey, mimeType: 'application/pdf', ingested: true, pageCount },
        }),
      );
      await withDbRetry(() => prisma.knowledgeChunk.deleteMany({ where: { documentId: doc.id } }));
      for (let i = 0; i < chunks.length; i += 200) {
        const slice = chunks.slice(i, i + 200);
        await withDbRetry(() =>
          prisma.knowledgeChunk.createMany({
            data: slice.map((c) => ({
              documentId: doc.id,
              sourceType: KnowledgeSourceType.CURRICULUM,
              subjectCode,
              grade: GRADE,
              content: c.content,
              tokenCount: c.tokenCount,
            })),
          }),
        );
      }
      chunksMade += chunks.length;
      ingested += 1;
      // eslint-disable-next-line no-console
      console.log(`${subjectCode.padEnd(12)} ${String(pageCount).padStart(3)}p -> ${String(chunks.length).padStart(4)} chunks   ${filename}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`ERROR ${filename}: ${(e as Error).message}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    RUN
      ? `\nDone. Ingested ${ingested} documents (${chunksMade} chunks), skipped ${skippedExisting} already-done, ${unmatched} unmatched. Run the embeddings backfill next.`
      : `\nDRY RUN — ${files.length - unmatched} matched, ${unmatched} unmatched. Re-run with SYLLABUS_RUN=1 to ingest.`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
