import { KnowledgeSourceType, PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { extractPdf } from '../src/modules/curriculum/ingestion/pdf.util';
import { chunkText } from '../src/modules/curriculum/ingestion/text-chunker';
import { withDbRetry } from '../src/common/utils/db-retry';

/**
 * Ingest ALREADY-DOWNLOADED Grade 12 past papers + marking guidelines sitting in
 * storage/Grade 12/<session>/*.pdf (the user supplied these directly, unlike
 * ingest-past-papers.ts which scrapes the DBE site). Creates a PastPaper row per
 * file (in-app browsing/download) and a CurriculumDocument + KnowledgeChunk[]
 * per file (AI tutor grounding + later structured-question extraction).
 *
 *   npm run db:ingest:local-papers            → DRY RUN (lists what it would do)
 *   PAPERS_RUN=1 npm run db:ingest:local-papers   → actually ingest
 *   PAPERS_FORCE=1 ...                            → re-ingest even if already done
 */
const prisma = new PrismaClient();
const STORAGE_DIR = process.env.STORAGE_LOCAL_DIR ?? './storage';
const BASE_DIR = path.join(STORAGE_DIR, 'Grade 12');
const RUN = process.env.PAPERS_RUN === '1';
const FORCE = process.env.PAPERS_FORCE === '1';

// Session sub-folders under storage/Grade 12 — used only as a fallback; the
// filename itself (year + Nov/May-June/September) is the primary source of truth,
// since a folder can contain a handful of stray files from another session.
const FOLDER_GRADE = 12;

// Subject keyword → canonical Subject.code actually seeded in the DB (verified via
// a live query — NOT guessed). Specific/longer phrases first.
const SUBJECT_MAP: Array<[string, string]> = [
  ['english fal', 'ENFAL-G10'],
  ['english hl', 'ENG-HL-G10'],
  ['computer applications', 'CAT-G10'],
  ['mathematical literacy', 'MLIT-G10'],
  ['mathematics', 'MATH-G10'],
  ['physical science', 'PHSC-G10'],
  ['life science', 'LIFE-G10'],
  ['life orientation', 'LFOR-G10'],
  ['geography', 'GEOG-G10'],
  ['history', 'HIST-G10'],
  ['accounting', 'ACCN-G10'],
  ['business studies', 'BSTD-G10'],
  ['busienss studies', 'BSTD-G10'], // typo present in one supplied filename
  ['economics', 'ECON-G10'],
  ['tourism', 'TOUR-G10'],
];

function matchSubject(filename: string): string | null {
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

interface Parsed {
  subjectCode: string;
  year: number;
  sessionLabel: string; // 'nov' | 'june' | 'sept'
  sessionDisplay: string;
  paper: string | null; // 'Paper 1' | 'Paper 2' | null (single-paper subjects)
  isMemo: boolean;
}

function parseFilename(filename: string): Parsed | null {
  const subjectCode = matchSubject(filename);
  if (!subjectCode) return null;

  const yearM = filename.match(/(20\d{2})/);
  if (!yearM) return null;
  const year = Number(yearM[1]);

  let sessionLabel: string;
  let sessionDisplay: string;
  if (/may-?june|\bjune\b/i.test(filename)) {
    sessionLabel = 'june';
    sessionDisplay = 'May/June';
  } else if (/september|sept/i.test(filename)) {
    sessionLabel = 'sept';
    sessionDisplay = 'September';
  } else if (/nov/i.test(filename)) {
    sessionLabel = 'nov';
    sessionDisplay = 'Nov';
  } else {
    return null;
  }

  const paper = /\bP1\b/.test(filename) ? 'Paper 1' : /\bP2\b/.test(filename) ? 'Paper 2' : null;
  const isMemo = /\bMG\b/.test(filename);

  return { subjectCode, year, sessionLabel, sessionDisplay, paper, isMemo };
}

async function main(): Promise<void> {
  if (!fs.existsSync(BASE_DIR)) {
    // eslint-disable-next-line no-console
    console.log(`No such folder: ${BASE_DIR}`);
    return;
  }

  const sessionDirs = fs.readdirSync(BASE_DIR).filter((d) => fs.statSync(path.join(BASE_DIR, d)).isDirectory());
  const files: string[] = [];
  for (const dir of sessionDirs) {
    for (const f of fs.readdirSync(path.join(BASE_DIR, dir))) {
      if (f.toLowerCase().endsWith('.pdf')) files.push(path.join(dir, f));
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Found ${files.length} PDFs across ${sessionDirs.length} session folders.\n`);

  let unmatched = 0;
  let ingested = 0;
  let skippedExisting = 0;
  let chunksMade = 0;
  let noText = 0;

  for (const rel of files) {
    const filename = path.basename(rel);
    const parsed = parseFilename(filename);
    if (!parsed) {
      unmatched += 1;
      // eslint-disable-next-line no-console
      console.log(`UNMATCHED: ${rel}`);
      continue;
    }

    const id = `pp-local-${slug(rel)}`;
    const subjectCode = parsed.subjectCode;
    // Relative to STORAGE_LOCAL_DIR (./storage) — what the file-serving endpoint reads.
    const storageKey = path.join('Grade 12', rel);

    if (!RUN) {
      // eslint-disable-next-line no-console
      console.log(
        `${subjectCode.padEnd(12)} ${String(parsed.year)} ${parsed.sessionDisplay.padEnd(9)} ${(parsed.paper ?? 'single').padEnd(8)} ${parsed.isMemo ? 'MEMO ' : 'PAPER'}  ${filename}`,
      );
      continue;
    }

    try {
      const existing = await withDbRetry(() => prisma.curriculumDocument.findUnique({ where: { id } }));
      if (existing?.ingested && !FORCE) {
        skippedExisting += 1;
        continue;
      }

      const subject = await withDbRetry(() => prisma.subject.findUnique({ where: { code: subjectCode } }));
      const kind = `${parsed.paper ? parsed.paper + ' ' : ''}${parsed.isMemo ? 'Marking Guideline' : 'Question Paper'}`.trim();
      const title = `${subject?.name ?? subjectCode} ${kind} (${parsed.sessionDisplay} ${parsed.year})`;

      await withDbRetry(() =>
        prisma.pastPaper.upsert({
          where: { id },
          update: { title, kind, grade: FOLDER_GRADE, year: parsed.year, subjectId: subject?.id, storageKey, mimeType: 'application/pdf' },
          create: { id, title, kind, grade: FOLDER_GRADE, year: parsed.year, subjectId: subject?.id, storageKey, mimeType: 'application/pdf' },
        }),
      );

      const bytes = fs.readFileSync(path.join(BASE_DIR, rel));
      const { text, pageCount } = await extractPdf(bytes);
      const chunks = chunkText(text);

      if (chunks.length === 0) {
        noText += 1;
        // eslint-disable-next-line no-console
        console.log(`  (no extractable text — PastPaper row created for download, no AI grounding) ${filename}`);
        await withDbRetry(() =>
          prisma.curriculumDocument.upsert({
            where: { id },
            update: { title, subjectCode, grade: FOLDER_GRADE, ingested: true, pageCount },
            create: { id, title, subjectCode, grade: FOLDER_GRADE, storageKey, mimeType: 'application/pdf', ingested: true, pageCount },
          }),
        );
        await withDbRetry(() => prisma.knowledgeChunk.deleteMany({ where: { documentId: id } }));
        ingested += 1;
        continue;
      }

      const doc = await withDbRetry(() =>
        prisma.curriculumDocument.upsert({
          where: { id },
          update: { title, subjectCode, grade: FOLDER_GRADE, ingested: true, pageCount },
          create: { id, title, subjectCode, grade: FOLDER_GRADE, storageKey, mimeType: 'application/pdf', ingested: true, pageCount },
        }),
      );
      await withDbRetry(() => prisma.knowledgeChunk.deleteMany({ where: { documentId: doc.id } }));
      const sourceType = parsed.isMemo ? KnowledgeSourceType.MARKING_GUIDE : KnowledgeSourceType.PAST_PAPER;
      for (let i = 0; i < chunks.length; i += 200) {
        const slice = chunks.slice(i, i + 200);
        await withDbRetry(() =>
          prisma.knowledgeChunk.createMany({
            data: slice.map((c) => ({
              documentId: doc.id,
              sourceType,
              subjectCode,
              grade: FOLDER_GRADE,
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
      ? `\nDone. Ingested ${ingested} files (${chunksMade} chunks, ${noText} with no extractable text), skipped ${skippedExisting} already-done, ${unmatched} unmatched. Run the embeddings backfill next.`
      : `\nDRY RUN — ${files.length - unmatched} matched, ${unmatched} unmatched. Re-run with PAPERS_RUN=1 to ingest.`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
