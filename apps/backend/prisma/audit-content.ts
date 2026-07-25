import 'dotenv/config';
import { existsSync, readdirSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const storageDir = process.env.STORAGE_LOCAL_DIR ?? './storage';

interface DatabaseSize {
  bytes: bigint;
}

interface GradeCoverage {
  grade: number;
  subjects: bigint;
  papers: bigint;
  documents: bigint;
  chunks: bigint;
  embedded: bigint;
}

interface OrphanCode {
  grade: number | null;
  subject_code: string | null;
}

interface GradeCodeMismatch {
  grade: number;
  subject_code: string;
  chunks: bigint;
}

interface SourceCoverage {
  source: string;
  documents: bigint;
  chunks: bigint;
  embedded: bigint;
}

function buildBasenameIndex(dir: string): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile()) {
        const name = entry.name.toLowerCase();
        index.set(name, [...(index.get(name) ?? []), fullPath]);
      }
    }
  };
  if (existsSync(dir)) {
    visit(dir);
  }
  return index;
}

function listLocalFiles(dir: string): string[] {
  const files: string[] = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  };
  if (existsSync(dir)) {
    visit(dir);
  }
  return files;
}

async function main(): Promise<void> {
  const [
    sizeRows,
    coverage,
    orphanCodes,
    gradeCodeMismatches,
    sourceCoverage,
    papers,
    documents,
  ] = await Promise.all([
    prisma.$queryRaw<DatabaseSize[]>`SELECT pg_database_size(current_database())::bigint AS bytes`,
    prisma.$queryRaw<GradeCoverage[]>`
      SELECT grades.grade,
        (SELECT COUNT(*) FROM subjects s WHERE s.grade = grades.grade)::bigint AS subjects,
        (SELECT COUNT(*) FROM past_papers p WHERE p.grade = grades.grade)::bigint AS papers,
        (SELECT COUNT(*) FROM curriculum_documents d WHERE d.grade = grades.grade)::bigint AS documents,
        (SELECT COUNT(*) FROM knowledge_chunks k WHERE k.grade = grades.grade)::bigint AS chunks,
        (SELECT COUNT(k.embedding) FROM knowledge_chunks k WHERE k.grade = grades.grade)::bigint AS embedded
      FROM generate_series(8, 12) AS grades(grade)
      ORDER BY grades.grade`,
    prisma.$queryRaw<OrphanCode[]>`
      SELECT DISTINCT k.grade, k.subject_code
      FROM knowledge_chunks k
      LEFT JOIN subjects s ON s.code = k.subject_code
      WHERE k.grade BETWEEN 8 AND 12
        AND k.subject_code IS NOT NULL
        AND s.id IS NULL
      ORDER BY k.grade, k.subject_code`,
    prisma.$queryRaw<GradeCodeMismatch[]>`
      SELECT grade, subject_code, COUNT(*)::bigint AS chunks
      FROM knowledge_chunks
      WHERE grade BETWEEN 8 AND 12
        AND subject_code ~ '-G[0-9]+$'
        AND substring(subject_code from '-G([0-9]+)$')::int <> grade
      GROUP BY grade, subject_code
      ORDER BY grade, subject_code`,
    prisma.$queryRaw<SourceCoverage[]>`
      SELECT
        CASE
          WHEN d.storage_key LIKE 'siyavula/%' THEN 'Siyavula textbooks'
          WHEN lower(d.storage_key) LIKE 'grade 12 syllabus/%' THEN 'Grade 12 syllabus'
          WHEN lower(d.storage_key) LIKE 'grade 12/%' THEN 'Grade 12 supplied papers'
          WHEN d.storage_key LIKE 'pastpapers/%' THEN 'Past-paper library'
          WHEN d.storage_key LIKE 'curriculum/%' THEN 'CAPS curriculum'
          ELSE 'Other'
        END AS source,
        COUNT(DISTINCT d.id)::bigint AS documents,
        COUNT(k.id)::bigint AS chunks,
        COUNT(k.embedding)::bigint AS embedded
      FROM curriculum_documents d
      LEFT JOIN knowledge_chunks k ON k.document_id = d.id
      GROUP BY source
      ORDER BY source`,
    prisma.pastPaper.findMany({ select: { storageKey: true } }),
    prisma.curriculumDocument.findMany({ select: { storageKey: true } }),
  ]);

  const keys = [
    ...new Set([...papers.map((paper) => paper.storageKey), ...documents.map((doc) => doc.storageKey)]),
  ].filter(Boolean);
  let localFiles = 0;
  let localBytes = 0;
  const missing: string[] = [];
  const referencedLocalFiles = new Set<string>();
  const basenameIndex = buildBasenameIndex(storageDir);
  for (const originalKey of keys) {
    const key = originalKey.split(/[\\/]/).join('/');
    const parts = key.split('/');
    if (parts.some((part) => part === '..') || path.isAbsolute(originalKey)) {
      missing.push(originalKey);
      continue;
    }
    let file = path.join(storageDir, ...parts);
    if (!existsSync(file)) {
      const matches = basenameIndex.get(path.basename(key).toLowerCase()) ?? [];
      if (matches.length !== 1) {
        missing.push(originalKey);
        continue;
      }
      file = matches[0];
    }
    localFiles += 1;
    localBytes += statSync(file).size;
    referencedLocalFiles.add(path.resolve(file).toLowerCase());
  }
  const unreferenced = listLocalFiles(storageDir).filter(
    (file) => !referencedLocalFiles.has(path.resolve(file).toLowerCase()),
  );

  console.table(
    coverage.map((row) => ({
      grade: row.grade,
      subjects: Number(row.subjects),
      papers: Number(row.papers),
      documents: Number(row.documents),
      chunks: Number(row.chunks),
      embedded: Number(row.embedded),
    })),
  );
  console.table(
    sourceCoverage.map((row) => ({
      source: row.source,
      documents: Number(row.documents),
      chunks: Number(row.chunks),
      embedded: Number(row.embedded),
    })),
  );
  console.log(`Database: ${(Number(sizeRows[0]?.bytes ?? 0n) / 1024 / 1024).toFixed(1)} MiB`);
  console.log(
    `Local S3 source: ${localFiles}/${keys.length} referenced files, ${(localBytes / 1024 / 1024).toFixed(1)} MiB`,
  );
  console.log(`Unmapped knowledge subject codes: ${orphanCodes.length}`);
  console.log(`Knowledge chunks with the wrong grade suffix: ${gradeCodeMismatches.length}`);
  console.log(`Local files without a database storage key: ${unreferenced.length}`);

  if (orphanCodes.length > 0) {
    console.table(orphanCodes);
  }
  if (gradeCodeMismatches.length > 0) {
    console.table(
      gradeCodeMismatches.map((row) => ({ ...row, chunks: Number(row.chunks) })),
    );
  }
  if (unreferenced.length > 0) {
    unreferenced
      .slice(0, 25)
      .forEach((file) => console.log(`  ${path.relative(storageDir, file)}`));
    if (unreferenced.length > 25) {
      console.log(`  ...and ${unreferenced.length - 25} more`);
    }
  }
  if (missing.length > 0) {
    console.error(`Missing local files: ${missing.length}`);
    missing.slice(0, 25).forEach((key) => console.error(`  ${key}`));
    if (missing.length > 25) {
      console.error(`  ...and ${missing.length - 25} more`);
    }
    process.exitCode = 2;
  }
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
