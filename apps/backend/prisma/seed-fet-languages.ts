import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds the FET (Grade 10–12) language subjects that the academic-subject seed
 * (seed-caps) didn't cover: Home Languages and the Afrikaans First Additional
 * Language. Codes align with the ingested Grade 10–12 CAPS language chunks
 * (e.g. ENG-HL-G10) so the tutor grounds on the real syllabus. Idempotent.
 *
 *   npm run db:seed:fet-lang
 */
const LANGUAGE_TOPICS = [
  'Listening and speaking',
  'Reading and viewing: comprehension',
  'Literature: novel, drama and poetry',
  'Writing and presenting: essays',
  'Writing and presenting: transactional texts',
  'Language structures and conventions',
];

const SUBJECTS: Array<{ name: string; code: string }> = [
  { name: 'English Home Language', code: 'ENG-HL-G10' },
  { name: 'Afrikaans Home Language', code: 'AFR-HL-G10' },
  { name: 'Afrikaans First Additional Language', code: 'AFR-FAL-G10' },
  { name: 'isiZulu Home Language', code: 'ZUL-HL-G10' },
  { name: 'isiXhosa Home Language', code: 'XHO-HL-G10' },
];

async function main(): Promise<void> {
  let topicCount = 0;
  for (const s of SUBJECTS) {
    const subject = await prisma.subject.upsert({
      where: { code: s.code },
      update: { name: s.name, grade: 10 },
      create: { name: s.name, code: s.code, grade: 10, weighting: 1 },
    });
    await prisma.topic.deleteMany({ where: { subjectId: subject.id } });
    await prisma.topic.createMany({
      data: LANGUAGE_TOPICS.map((title, i) => ({ subjectId: subject.id, title, orderIndex: i, importance: 1 })),
    });
    topicCount += LANGUAGE_TOPICS.length;
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${SUBJECTS.length} FET language subjects with ${topicCount} topics (grade 10).`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
