import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds the CAPS Senior Phase (Grade 8–9) curriculum: the 8 compulsory core
 * subjects and their main topic strands. Seeded at grade 9 (the senior end of the
 * phase) — onboarding maps Grade 8 students to the same Senior-Phase set. Codes
 * align with the ingested Grade 7–9 CAPS chunks (e.g. NATSCI-G9) so the tutor and
 * question generator ground on the real syllabus.
 *
 *   npm run db:seed:sp
 */
const GRADE = 9;

const SUBJECTS: Array<{ name: string; code: string; topics: string[] }> = [
  {
    name: 'English Home Language',
    code: 'ENG-HL-G9',
    topics: [
      'Listening and speaking',
      'Reading and viewing: comprehension',
      'Writing and presenting',
      'Language structures and conventions',
      'Literature: poetry, drama and prose',
    ],
  },
  {
    name: 'English First Additional Language',
    code: 'ENG-FAL-G9',
    topics: [
      'Listening and speaking',
      'Reading and viewing: comprehension',
      'Writing and presenting',
      'Language structures and conventions',
      'Literature: poetry, drama and prose',
    ],
  },
  {
    name: 'Mathematics',
    code: 'MATH-G9',
    topics: [
      'Numbers, operations and relationships',
      'Patterns, functions and algebra',
      'Space and shape (Geometry)',
      'Measurement',
      'Data handling and probability',
    ],
  },
  {
    name: 'Natural Sciences',
    code: 'NATSCI-G9',
    topics: [
      'Life and living',
      'Matter and materials',
      'Energy and change',
      'Planet Earth and beyond',
    ],
  },
  {
    name: 'Social Sciences',
    code: 'SOCSCI-G9',
    topics: [
      'Geography: Map skills and tools',
      'Geography: Population and settlement',
      'Geography: Resources and sustainability',
      'History: Themes and periods',
      'History: Working with sources and evidence',
    ],
  },
  {
    name: 'Economic and Management Sciences',
    code: 'EMS-G9',
    topics: [
      'The economy and economic systems',
      'Financial literacy (accounting and budgeting)',
      'Entrepreneurship',
    ],
  },
  {
    name: 'Technology',
    code: 'TECH-G9',
    topics: [
      'Structures',
      'Processing',
      'Mechanical systems and control',
      'Electrical systems and control',
      'Graphic communication (drawing)',
    ],
  },
  {
    name: 'Life Orientation',
    code: 'LFOR-G9',
    topics: [
      'Development of the self in society',
      'Health, social and environmental responsibility',
      'Constitutional rights and responsibilities',
      'Physical education',
      'World of work and career choices',
    ],
  },
  {
    name: 'Creative Arts',
    code: 'CART-G9',
    topics: ['Visual Arts', 'Dance', 'Drama', 'Music'],
  },
];

async function main(): Promise<void> {
  let topicCount = 0;
  for (const s of SUBJECTS) {
    const subject = await prisma.subject.upsert({
      where: { code: s.code },
      update: { name: s.name, grade: GRADE },
      create: { name: s.name, code: s.code, grade: GRADE, weighting: 1 },
    });
    await prisma.topic.deleteMany({ where: { subjectId: subject.id } });
    await prisma.topic.createMany({
      data: s.topics.map((title, i) => ({ subjectId: subject.id, title, orderIndex: i, importance: 1 })),
    });
    topicCount += s.topics.length;
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${SUBJECTS.length} Senior Phase subjects with ${topicCount} topics (grade ${GRADE}).`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
