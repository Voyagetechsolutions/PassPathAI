import { KnowledgeSourceType, PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { extractPdf } from '../src/modules/curriculum/ingestion/pdf.util';
import { chunkText } from '../src/modules/curriculum/ingestion/text-chunker';
import { withDbRetry } from '../src/common/utils/db-retry';

/**
 * Auto-fetch past papers + memos from the DBE website and ingest them.
 *
 * Each DBE session page (e.g. "2023 NSC November past papers") lists every
 * subject as a "Documents" module with download links. We associate each link
 * with its subject, keep the English/bilingual papers and memos, download them,
 * create PastPaper rows (for the in-app browser) and KnowledgeChunks (so the AI
 * tutor can ground on real exam questions + marking guidelines).
 *
 *   npm run db:ingest:papers              → DRY RUN (lists what it would fetch)
 *   PAST_PAPERS_RUN=1 npm run db:ingest:papers   → actually download + ingest
 *
 * Optional: PAST_PAPERS_SUBJECTS=MATH-G10,PHSC-G10  → restrict to those codes.
 */
const prisma = new PrismaClient();
const STORAGE_DIR = process.env.STORAGE_LOCAL_DIR ?? './storage';
const RUN = process.env.PAST_PAPERS_RUN === '1';
const AI_INGEST = process.env.PAST_PAPERS_AI !== '0'; // default on
const SUBJECT_FILTER = (process.env.PAST_PAPERS_SUBJECTS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

interface Session {
  url: string;
  year: number;
  grade: number;
  label: string; // short slug to disambiguate sessions in the same year, e.g. 'nov', 'june'
  display: string; // human label, e.g. 'Nov', 'May/June'
}

// DBE NSC session pages. Add more as needed (prior years, Grade 10/11 commons).
const SESSIONS: Session[] = [
  { url: 'https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/2023NSCNovemberpastpapers.aspx', year: 2023, grade: 12, label: 'nov', display: 'Nov' },
  { url: 'https://www.education.gov.za/2024NSCNovemberpastpapers.aspx', year: 2024, grade: 12, label: 'nov', display: 'Nov' },
  { url: 'https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/2024MayJuneExampapers.aspx', year: 2024, grade: 12, label: 'june', display: 'May/June' },
  { url: 'https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/2023MayJuneExamPapers.aspx', year: 2023, grade: 12, label: 'june', display: 'May/June' },
  { url: 'https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/2022MayJuneExamPapers.aspx', year: 2022, grade: 12, label: 'june', display: 'May/June' },
];

// Subject title keyword → canonical curriculum code (so past-paper chunks share a
// subject code with the syllabus + the student's enrolled subject). Specific first.
const SUBJECT_MAP: Array<[string, string]> = [
  ['mathematical literacy', 'MLIT-G10'],
  ['technical mathematics', 'TMATH-G10'],
  ['mathematics', 'MATH-G10'],
  ['physical science', 'PHSC-G10'],
  ['technical science', 'TSCI-G10'],
  ['life science', 'LIFE-G10'],
  ['agricultural management', 'AGRM-G10'],
  ['agricultural technology', 'AGRT-G10'],
  ['agricultural science', 'AGRI-G10'],
  ['geography', 'GEOG-G10'],
  ['history', 'HIST-G10'],
  ['accounting', 'ACCN-G10'],
  ['business studies', 'BSTD-G10'],
  ['economics', 'ECON-G10'],
  ['tourism', 'TOUR-G10'],
  ['consumer studies', 'CONS-G10'],
  ['hospitality studies', 'HOSP-G10'],
  ['computer applications', 'CAT-G10'],
  ['information technology', 'IT-G10'],
  ['engineering graphic', 'EGD-G10'],
  ['civil technology', 'CIVT-G10'],
  ['electrical technology', 'ELET-G10'],
  ['mechanical technology', 'MECT-G10'],
  ['dramatic arts', 'DRAM-G10'],
  ['visual arts', 'VART-G10'],
  ['dance studies', 'DANC-G10'],
  ['design', 'DSGN-G10'],
  ['music', 'MUSC-G10'],
  ['religion studies', 'RELS-G10'],
  ['marine science', 'MARI-G10'],
  ['maritime economics', 'MARE-G10'],
  ['nautical science', 'NAUT-G10'],
  ['sport and exercise', 'SPRT-G10'],
  ['equine', 'EQUI-G10'],
  ['english home', 'ENG-HL-G10'],
  ['english first additional', 'ENG-FAL-G10'],
];

const LANGUAGE_CODES = new Set(['ENG-HL-G10', 'ENG-FAL-G10']);

function subjectToCode(title: string): string | null {
  const lower = title.toLowerCase();
  for (const [kw, code] of SUBJECT_MAP) {
    if (lower.includes(kw)) {
      return code;
    }
  }
  return null;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

interface DocLink {
  text: string;
  href: string;
  kind: string;
  sourceType: KnowledgeSourceType;
  aiIngest: boolean;
}

/** Decide whether to keep a document link and how to classify it. */
function classify(text: string, isLanguageSubject: boolean): DocLink | null {
  const lower = text.toLowerCase();
  if (/^download$/i.test(text) || text.length === 0) {
    return null;
  }
  // For non-language subjects, skip Afrikaans-only PDFs (keep English / bilingual).
  if (!isLanguageSubject && lower.includes('afrikaans') && !lower.includes('english')) {
    return null;
  }
  const isMemo = /\bmemo|memorand|nasienriglyn/.test(lower);
  const isAnswerbook = /answer\s?book|antwoorde/.test(lower);
  const cleanKind = decode(text.replace(/\((afrikaans|english)[^)]*\)/gi, '')).trim() || text;
  if (isAnswerbook) {
    return { text, href: '', kind: cleanKind, sourceType: KnowledgeSourceType.PAST_PAPER, aiIngest: false };
  }
  return {
    text,
    href: '',
    kind: cleanKind,
    sourceType: isMemo ? KnowledgeSourceType.MARKING_GUIDE : KnowledgeSourceType.PAST_PAPER,
    aiIngest: true,
  };
}

interface SubjectGroup {
  title: string;
  code: string;
  isLanguage: boolean;
  docs: DocLink[];
}

function parsePage(html: string): SubjectGroup[] {
  const groups: SubjectGroup[] = [];
  const blocks = html.split('DnnModule-DNN_Documents').slice(1);
  for (const block of blocks) {
    const titleM = block.match(/eds_containerTitle"[^>]*>([^<]+)</);
    if (!titleM) {
      continue;
    }
    const title = decode(titleM[1]);
    const code = subjectToCode(title);
    if (!code) {
      continue;
    }
    if (SUBJECT_FILTER.length && !SUBJECT_FILTER.includes(code)) {
      continue;
    }
    const isLanguage = LANGUAGE_CODES.has(code);
    const docs: DocLink[] = [];
    const linkRe = /href="(\/LinkClick\.aspx\?fileticket=[^"]+)"[^>]*>([^<]+)<\/a>/g;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(block)) !== null) {
      const href = decode(m[1]);
      const text = decode(m[2]);
      const d = classify(text, isLanguage);
      if (d) {
        docs.push({ ...d, href });
      }
    }
    if (docs.length) {
      groups.push({ title, code, isLanguage, docs });
    }
  }
  return groups;
}

async function fetchBuffer(url: string): Promise<Buffer> {
  let lastErr: unknown;
  for (let i = 0; i < 3; i += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetch failed');
}

async function fetchText(url: string): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < 3; i += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      return await res.text();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetch failed');
}

async function main(): Promise<void> {
  let plannedDocs = 0;
  let downloaded = 0;
  let chunksMade = 0;

  for (const session of SESSIONS) {
    const origin = new URL(session.url).origin;
    // eslint-disable-next-line no-console
    console.log(`\n=== ${session.year} ${session.display} (Grade ${session.grade}) — ${session.url}`);
    let html: string;
    try {
      html = await fetchText(session.url);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`  page fetch failed, skipping session: ${(e as Error).message}`);
      continue;
    }
    const groups = parsePage(html);
    // eslint-disable-next-line no-console
    console.log(`Matched ${groups.length} subjects:`);

    for (const g of groups) {
      plannedDocs += g.docs.length;
      // eslint-disable-next-line no-console
      console.log(`  ${g.code.padEnd(11)} ${g.title} — ${g.docs.length} docs`);
      if (!RUN) {
        for (const d of g.docs) {
          // eslint-disable-next-line no-console
          console.log(`      [${d.sourceType}] ${d.kind}`);
        }
        continue;
      }

      for (const d of g.docs) {
        const fileSlug = slug(`${d.kind}`);
        const id = `pp-${g.code}-${session.year}-${session.label}-${fileSlug}`;
        const key = `pastpapers/${g.code}-${session.year}-${session.label}-${fileSlug}.pdf`;
        if (!process.env.PAST_PAPERS_FORCE && fs.existsSync(path.join(STORAGE_DIR, key))) {
          continue; // already fetched in a previous run
        }
        try {
          const bytes = await fetchBuffer(origin + d.href);
          if (bytes.subarray(0, 4).toString() !== '%PDF') {
            // eslint-disable-next-line no-console
            console.log(`      skip (not a PDF): ${d.kind}`);
            continue;
          }
          fs.mkdirSync(path.join(STORAGE_DIR, 'pastpapers'), { recursive: true });
          fs.writeFileSync(path.join(STORAGE_DIR, key), bytes);
          downloaded += 1;

          const subject = await withDbRetry(() =>
            prisma.subject.findUnique({ where: { code: g.code } }),
          );
          await withDbRetry(() =>
            prisma.pastPaper.upsert({
              where: { id },
              update: { title: `${g.title} ${d.kind} (${session.display} ${session.year})`, kind: d.kind, grade: session.grade, year: session.year, subjectId: subject?.id, storageKey: key, mimeType: 'application/pdf' },
              create: { id, title: `${g.title} ${d.kind} (${session.display} ${session.year})`, kind: d.kind, grade: session.grade, year: session.year, subjectId: subject?.id, storageKey: key, mimeType: 'application/pdf' },
            }),
          );

          if (AI_INGEST && d.aiIngest) {
            const { text, pageCount } = await extractPdf(bytes);
            const chunks = chunkText(text);
            if (chunks.length) {
              const doc = await withDbRetry(() =>
                prisma.curriculumDocument.upsert({
                  where: { id },
                  update: { title: `${g.title} ${d.kind} ${session.display} ${session.year}`, subjectCode: g.code, grade: session.grade, ingested: true, pageCount },
                  create: { id, title: `${g.title} ${d.kind} ${session.display} ${session.year}`, subjectCode: g.code, grade: session.grade, storageKey: key, mimeType: 'application/pdf', ingested: true, pageCount },
                }),
              );
              await withDbRetry(() => prisma.knowledgeChunk.deleteMany({ where: { documentId: doc.id } }));
              for (let i = 0; i < chunks.length; i += 200) {
                const sliceC = chunks.slice(i, i + 200);
                await withDbRetry(() =>
                  prisma.knowledgeChunk.createMany({
                    data: sliceC.map((c) => ({
                      documentId: doc.id,
                      sourceType: d.sourceType,
                      subjectCode: g.code,
                      grade: session.grade,
                      content: c.content,
                      tokenCount: c.tokenCount,
                    })),
                  }),
                );
              }
              chunksMade += chunks.length;
            }
          }
          // eslint-disable-next-line no-console
          console.log(`      ✓ ${d.kind} (${(bytes.length / 1024).toFixed(0)}KB)`);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.log(`      ✗ ${d.kind}: ${(e as Error).message}`);
        }
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    RUN
      ? `\nDone. Downloaded ${downloaded} files, created ${chunksMade} chunks. Run the embeddings backfill next.`
      : `\nDRY RUN — would fetch ${plannedDocs} documents. Re-run with PAST_PAPERS_RUN=1 to download + ingest.`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
