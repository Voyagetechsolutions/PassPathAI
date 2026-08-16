require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');

if (fs.existsSync('.env')) {
  const configuredUrls = [...fs.readFileSync('.env', 'utf8').matchAll(/^DATABASE_URL=(.+)$/gm)]
    .map((match) => match[1].trim().replace(/^['"]|['"]$/g, ''));
  process.env.DATABASE_URL = configuredUrls.at(-1) ?? process.env.DATABASE_URL;
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const run = process.env.PAPER_GRADE_REPAIR_RUN === '1';

function inferMetadata(storageKey) {
  const basename = path.posix.basename(storageKey.split('\\').join('/'));
  const match = basename.match(/^([A-Z]+(?:-[A-Z]+)?)-G(10|11|12)-/i);
  if (!match) return null;
  const prefix = match[1].toUpperCase() === 'ENG-FAL' ? 'ENFAL' : match[1].toUpperCase();
  const targetGrade = Number(match[2]);
  return { targetGrade, subjectCode: `${prefix}-G${targetGrade}` };
}

async function main() {
  const [papers, subjects] = await Promise.all([
    prisma.pastPaper.findMany({
      where: { storageKey: { startsWith: 'pastpapers/' } },
      select: { id: true, grade: true, subjectId: true, storageKey: true },
    }),
    prisma.subject.findMany({ select: { id: true, code: true } }),
  ]);
  const subjectByCode = new Map(subjects.map((subject) => [subject.code, subject.id]));
  const repairs = [];
  const missingSubjects = new Set();

  for (const paper of papers) {
    const inferred = inferMetadata(paper.storageKey);
    if (!inferred) continue;
    const targetSubjectId = subjectByCode.get(inferred.subjectCode) ?? null;
    if (!targetSubjectId) missingSubjects.add(inferred.subjectCode);
    if (paper.grade !== inferred.targetGrade || (targetSubjectId && paper.subjectId !== targetSubjectId)) {
      repairs.push({ ...paper, ...inferred, targetSubjectId });
    }
  }

  const summary = repairs.reduce((rows, paper) => {
    const target = `Grade ${paper.targetGrade} · ${paper.subjectCode}`;
    rows[target] = (rows[target] ?? 0) + 1;
    return rows;
  }, {});

  console.log(`scanned ${papers.length} paper-library rows`);
  console.log(`repairs required: ${repairs.length}`);
  console.table(Object.entries(summary).map(([target, count]) => ({ target, count })));
  if (missingSubjects.size) console.warn(`missing subject rows: ${[...missingSubjects].join(', ')}`);

  if (!run) {
    console.log('dry run only; set PAPER_GRADE_REPAIR_RUN=1 to apply');
    return;
  }

  let updated = 0;
  for (let i = 0; i < repairs.length; i += 100) {
    const batch = repairs.slice(i, i + 100);
    await prisma.$transaction(
      batch.map((paper) => prisma.pastPaper.update({
        where: { id: paper.id },
        data: {
          grade: paper.targetGrade,
          ...(paper.targetSubjectId ? { subjectId: paper.targetSubjectId } : {}),
        },
      })),
    );
    updated += batch.length;
  }
  console.log(`updated ${updated} paper rows`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
