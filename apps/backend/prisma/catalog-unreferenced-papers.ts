import 'dotenv/config';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const storageDir = process.env.STORAGE_LOCAL_DIR ?? './storage';
const papersDir = path.join(storageDir, 'pastpapers');
const defaultGrade = Number.parseInt(process.env.PAPER_DEFAULT_GRADE ?? '12', 10);
const run = process.env.UNREFERENCED_PAPERS_RUN === '1';
const subjectNames: Record<string, string> = {
  EGD: 'Engineering Graphics and Design',
};

function listPdfs(dir: string): string[] {
  const files: string[] = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) files.push(fullPath);
    }
  };
  if (existsSync(dir)) visit(dir);
  return files;
}

function inferGrade(filename: string): number {
  const match = filename.match(/-G(10|11|12)-/i);
  return match ? Number(match[1]) : defaultGrade;
}

function inferSubjectCode(filename: string, grade: number): string | null {
  const match = filename.match(/^([A-Z]+(?:-[A-Z]+)?)-G\d+-/i);
  if (!match) return null;
  const prefix = match[1].toUpperCase() === 'ENG-FAL' ? 'ENFAL' : match[1].toUpperCase();
  return `${prefix}-G${grade}`;
}

function inferYear(filename: string): number | null {
  const match = filename.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function inferKind(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes('answer-book') || lower.includes('answerbook')) return 'Answer Book';
  if (/\b(memo|memorandum|marking|mg)\b/.test(lower)) return 'Memo';
  if (/(paper|p)-?1\b/.test(lower)) return 'Paper 1';
  if (/(paper|p)-?2\b/.test(lower)) return 'Paper 2';
  if (/(paper|p)-?3\b/.test(lower)) return 'Paper 3';
  return 'Question Paper';
}

function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\bnov\b/gi, 'November')
    .replace(/\bmg\b/gi, 'Memo')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main(): Promise<void> {
  const [papers, documents, subjects] = await Promise.all([
    prisma.pastPaper.findMany({ select: { storageKey: true } }),
    prisma.curriculumDocument.findMany({ select: { storageKey: true } }),
    prisma.subject.findMany({ select: { id: true, code: true } }),
  ]);
  const existingKeys = new Set(
    [...papers.map((paper) => paper.storageKey), ...documents.map((doc) => doc.storageKey)].map(
      (key) => key.split(/[\\/]/).join('/').toLowerCase(),
    ),
  );
  const existingBasenames = new Set(
    [...existingKeys].map((key) => path.posix.basename(key).toLowerCase()),
  );
  const subjectByCode = new Map(subjects.map((subject) => [subject.code, subject.id]));

  let ready = 0;
  let skipped = 0;
  for (const file of listPdfs(papersDir)) {
    const storageKey = path.relative(storageDir, file).split(path.sep).join('/');
    const basename = path.basename(file);
    if (
      existingKeys.has(storageKey.toLowerCase()) ||
      existingBasenames.has(basename.toLowerCase())
    ) {
      continue;
    }
    const grade = inferGrade(basename);
    const subjectCode = inferSubjectCode(basename, grade);
    const year = inferYear(basename);
    if (!subjectCode || !year) {
      console.warn(`SKIP cannot infer subject/year: ${storageKey}`);
      skipped += 1;
      continue;
    }
    let subjectId = subjectByCode.get(subjectCode);
    if (!subjectId && subjectNames[subjectCode.replace(/-G\d+$/, '')]) {
      const name = subjectNames[subjectCode.replace(/-G\d+$/, '')];
      if (run) {
        const subject = await prisma.subject.upsert({
          where: { code: subjectCode },
          update: { name, grade },
          create: { code: subjectCode, name, grade },
        });
        subjectId = subject.id;
        subjectByCode.set(subjectCode, subject.id);
      } else {
        console.log(`NEW SUBJECT    ${subjectCode} ${name}`);
      }
    }
    const kind = inferKind(basename);
    const title = titleFromFilename(basename);
    const id = `storage-${createHash('sha256').update(storageKey).digest('hex').slice(0, 24)}`;

    if (run) {
      await prisma.pastPaper.upsert({
        where: { id },
        update: { title, subjectId, grade, year, kind, storageKey, mimeType: 'application/pdf' },
        create: { id, title, subjectId, grade, year, kind, storageKey, mimeType: 'application/pdf' },
      });
    } else {
      console.log(`${subjectCode.padEnd(14)} ${year} ${kind.padEnd(14)} ${storageKey}`);
    }
    ready += 1;
  }
  console.log(
    run
      ? `catalogued ${ready} additional papers; skipped ${skipped}`
      : `dry run: ${ready} additional papers ready; ${skipped} skipped`,
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
