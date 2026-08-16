const fs = require('node:fs');
require('dotenv').config();

const urls = [...fs.readFileSync('.env', 'utf8').matchAll(/^DATABASE_URL=(.+)$/gm)]
  .map((match) => match[1].trim().replace(/^['"]|['"]$/g, ''));
process.env.DATABASE_URL = urls.at(-1);

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const run = process.env.FET_SUBJECT_REPAIR_RUN === '1';

const required = new Map([
  ['EGD', 'Engineering Graphics and Design'],
  ['NSO-HL', 'Sepedi Home Language'],
  ['VEN-HL', 'Tshivenda Home Language'],
  ['ZUL-FAL', 'isiZulu First Additional Language'],
]);

const normaliseBase = (code) => code.replace(/-G(?:10|11|12)$/, '').replace(/^ENG-FAL$/, 'ENFAL');

async function main() {
  const subjects = await prisma.subject.findMany({
    where: { grade: { in: [10, 11, 12] } },
    select: { id: true, code: true, name: true, grade: true },
  });

  const legacyEnglish = subjects.find((subject) => subject.code === 'ENG-FAL-G11');
  if (legacyEnglish && !subjects.some((subject) => subject.code === 'ENFAL-G11')) {
    console.log('normalise ENG-FAL-G11 -> ENFAL-G11');
    if (run) {
      await prisma.$transaction([
        prisma.subject.update({ where: { id: legacyEnglish.id }, data: { code: 'ENFAL-G11' } }),
        prisma.knowledgeChunk.updateMany({ where: { subjectCode: 'ENG-FAL-G11' }, data: { subjectCode: 'ENFAL-G11' } }),
        prisma.curriculumDocument.updateMany({ where: { subjectCode: 'ENG-FAL-G11' }, data: { subjectCode: 'ENFAL-G11' } }),
      ]);
    }
  }

  const familyNames = new Map(required);
  for (const subject of subjects) {
    const family = normaliseBase(subject.code);
    if (!familyNames.has(family)) familyNames.set(family, subject.name);
  }
  const existingCodes = new Set(subjects.map((subject) => subject.code.replace(/^ENG-FAL-G11$/, 'ENFAL-G11')));
  const missing = [];
  for (const [family, name] of [...familyNames].sort(([a], [b]) => a.localeCompare(b))) {
    for (const grade of [10, 11, 12]) {
      const code = `${family}-G${grade}`;
      if (!existingCodes.has(code)) missing.push({ code, name, grade });
    }
  }

  console.log(`subject families: ${familyNames.size}`);
  console.log(`missing subject-grade rows: ${missing.length}`);
  if (missing.length) console.table(missing);
  if (!run) {
    console.log('dry run only; set FET_SUBJECT_REPAIR_RUN=1 to apply');
    return;
  }
  for (const subject of missing) {
    await prisma.subject.create({ data: { ...subject, weighting: 1 } });
  }
  console.log(`created ${missing.length} subject-grade rows`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
