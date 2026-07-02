import { PrismaClient, QuestionType, Difficulty } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Minimal but real seed: one Grade-10 Mathematics subject with a topic, subtopic,
 * a multiple-choice question, a diagnostic test, and core AI settings + a sample
 * career. Enough to exercise the API end to end. Idempotent via upsert on codes.
 */
async function main(): Promise<void> {
  const subject = await prisma.subject.upsert({
    where: { code: 'MATH-G10' },
    update: {},
    create: { name: 'Mathematics', code: 'MATH-G10', grade: 10, weighting: 1 },
  });

  const topic = await prisma.topic.upsert({
    where: { id: 'seed-topic-algebra' },
    update: {},
    create: {
      id: 'seed-topic-algebra',
      subjectId: subject.id,
      title: 'Algebraic Expressions',
      description: 'Simplification, factorisation and exponents.',
      orderIndex: 1,
      importance: 1,
    },
  });

  const subtopic = await prisma.subtopic.upsert({
    where: { id: 'seed-subtopic-factorisation' },
    update: {},
    create: {
      id: 'seed-subtopic-factorisation',
      topicId: topic.id,
      title: 'Factorisation',
      orderIndex: 1,
    },
  });

  const question = await prisma.question.upsert({
    where: { id: 'seed-q-factorise' },
    update: {},
    create: {
      id: 'seed-q-factorise',
      subjectId: subject.id,
      topicId: topic.id,
      subtopicId: subtopic.id,
      type: QuestionType.MULTIPLE_CHOICE,
      difficulty: Difficulty.EASY,
      prompt: 'Factorise: x² − 9',
      marks: 1,
      options: {
        create: [
          { label: 'A', text: '(x − 3)(x + 3)', isCorrect: true },
          { label: 'B', text: '(x − 9)(x + 1)', isCorrect: false },
          { label: 'C', text: '(x − 3)²', isCorrect: false },
          { label: 'D', text: 'x(x − 9)', isCorrect: false },
        ],
      },
    },
  });

  const test = await prisma.diagnosticTest.upsert({
    where: { id: 'seed-diagnostic-math-g10' },
    update: {},
    create: {
      id: 'seed-diagnostic-math-g10',
      subjectId: subject.id,
      grade: 10,
      title: 'Grade 10 Mathematics Diagnostic',
    },
  });

  await prisma.diagnosticTestItem.upsert({
    where: { testId_questionId: { testId: test.id, questionId: question.id } },
    update: {},
    create: { testId: test.id, questionId: question.id, orderIndex: 1 },
  });

  const settings: Array<[string, string]> = [
    ['chat_model', 'gpt-4o-mini'],
    ['embedding_model', 'text-embedding-3-small'],
    ['retrieval_top_k', '5'],
    ['min_similarity', '0.3'],
  ];
  for (const [key, value] of settings) {
    await prisma.aiSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  const career = await prisma.career.upsert({
    where: { title: 'Civil Engineer' },
    update: {},
    create: {
      title: 'Civil Engineer',
      description: 'Designs and builds infrastructure such as roads, bridges and buildings.',
      subjectRequirements: {
        create: [
          { subjectName: 'Mathematics', minPercent: 70 },
          { subjectName: 'Physical Sciences', minPercent: 60 },
        ],
      },
      programmes: {
        create: [
          {
            university: 'University of Cape Town',
            programmeName: 'BSc Civil Engineering',
            minAps: 42,
            requirements: {
              create: [
                { subjectName: 'Mathematics', minPercent: 70 },
                { subjectName: 'Physical Sciences', minPercent: 60 },
                { subjectName: 'English', minPercent: 50 },
              ],
            },
          },
        ],
      },
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded subject=${subject.code} topic=${topic.title} career=${career.title}`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
