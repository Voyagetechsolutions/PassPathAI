import { Difficulty, KnowledgeSourceType, PrismaClient, QuestionType } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const STORAGE_DIR = process.env.STORAGE_LOCAL_DIR ?? './storage';

/** Write a placeholder past-paper file to local storage and return its key. */
function writePaperFile(content: string): string {
  const dir = path.join(STORAGE_DIR, 'pastpapers');
  fs.mkdirSync(dir, { recursive: true });
  const key = `pastpapers/${randomUUID()}.txt`;
  fs.writeFileSync(path.join(STORAGE_DIR, key), content, 'utf8');
  return key;
}

/**
 * Seeds a REAL, curriculum-aligned subject: CAPS Grade 10 Mathematics — with
 * topics, multiple-choice questions, a diagnostic test, curriculum knowledge for
 * the AI tutor, careers, and exam dates. Idempotent (delete-then-create by code).
 * Enrols the demo student so the app is immediately usable.
 */

const TOPICS: Array<{ title: string; importance: number; subtopics: string[] }> = [
  { title: 'Algebraic Expressions', importance: 1.0, subtopics: ['Factorisation', 'Simplification'] },
  { title: 'Exponents', importance: 0.9, subtopics: ['Exponent laws'] },
  { title: 'Equations and Inequalities', importance: 1.0, subtopics: ['Linear equations'] },
  { title: 'Number Patterns', importance: 0.7, subtopics: ['Arithmetic sequences'] },
  { title: 'Functions and Graphs', importance: 1.0, subtopics: ['Linear functions'] },
  { title: 'Trigonometry', importance: 0.9, subtopics: ['Trig ratios', 'Special angles'] },
  { title: 'Euclidean Geometry', importance: 0.8, subtopics: ['Angle relationships'] },
  { title: 'Finance and Growth', importance: 0.7, subtopics: ['Simple interest'] },
];

interface Q {
  topic: string;
  difficulty: Difficulty;
  prompt: string;
  options: Array<[string, boolean]>;
}

const QUESTIONS: Q[] = [
  { topic: 'Algebraic Expressions', difficulty: Difficulty.EASY, prompt: 'Factorise x² − 16.', options: [['(x − 4)(x + 4)', true], ['(x − 16)(x + 1)', false], ['(x − 4)²', false], ['x(x − 16)', false]] },
  { topic: 'Algebraic Expressions', difficulty: Difficulty.MEDIUM, prompt: 'Factorise x² + 7x + 12.', options: [['(x + 3)(x + 4)', true], ['(x + 2)(x + 6)', false], ['(x + 1)(x + 12)', false], ['(x − 3)(x − 4)', false]] },
  { topic: 'Exponents', difficulty: Difficulty.EASY, prompt: 'Simplify x³ · x⁴.', options: [['x⁷', true], ['x¹²', false], ['x¹', false], ['x⁻¹', false]] },
  { topic: 'Exponents', difficulty: Difficulty.EASY, prompt: 'Evaluate 5⁰.', options: [['1', true], ['0', false], ['5', false], ['undefined', false]] },
  { topic: 'Equations and Inequalities', difficulty: Difficulty.EASY, prompt: 'Solve for x: 2x + 6 = 14.', options: [['x = 4', true], ['x = 10', false], ['x = 8', false], ['x = 2', false]] },
  { topic: 'Equations and Inequalities', difficulty: Difficulty.MEDIUM, prompt: 'Solve for x: x/3 = 5.', options: [['x = 15', true], ['x = 8', false], ['x = 5/3', false], ['x = 2', false]] },
  { topic: 'Number Patterns', difficulty: Difficulty.EASY, prompt: 'Find the next term: 2, 5, 8, 11, …', options: [['14', true], ['13', false], ['15', false], ['12', false]] },
  { topic: 'Number Patterns', difficulty: Difficulty.MEDIUM, prompt: 'For Tₙ = 3n + 1, find T₅.', options: [['16', true], ['15', false], ['13', false], ['18', false]] },
  { topic: 'Functions and Graphs', difficulty: Difficulty.EASY, prompt: 'What is the gradient of y = 2x + 3?', options: [['2', true], ['3', false], ['−2', false], ['1', false]] },
  { topic: 'Functions and Graphs', difficulty: Difficulty.EASY, prompt: 'What is the y-intercept of y = 2x + 3?', options: [['3', true], ['2', false], ['0', false], ['−3', false]] },
  { topic: 'Trigonometry', difficulty: Difficulty.EASY, prompt: 'What is sin 30°?', options: [['0.5', true], ['1', false], ['0', false], ['0.866', false]] },
  { topic: 'Trigonometry', difficulty: Difficulty.MEDIUM, prompt: 'In a right-angled triangle, tan θ equals opposite over …', options: [['adjacent', true], ['hypotenuse', false], ['opposite', false], ['perimeter', false]] },
  { topic: 'Euclidean Geometry', difficulty: Difficulty.EASY, prompt: 'Angles on a straight line add up to …', options: [['180°', true], ['90°', false], ['360°', false], ['270°', false]] },
  { topic: 'Euclidean Geometry', difficulty: Difficulty.EASY, prompt: 'The interior angles of a triangle add up to …', options: [['180°', true], ['360°', false], ['90°', false], ['270°', false]] },
  { topic: 'Finance and Growth', difficulty: Difficulty.EASY, prompt: 'Simple interest on R1 000 at 10% p.a. for 1 year is …', options: [['R100', true], ['R10', false], ['R1 000', false], ['R110', false]] },
  { topic: 'Finance and Growth', difficulty: Difficulty.MEDIUM, prompt: 'Using A = P(1 + in), find A for P = R500, i = 0.1, n = 2.', options: [['R600', true], ['R550', false], ['R1 000', false], ['R510', false]] },
];

const KNOWLEDGE: Array<{ topic: string; content: string }> = [
  { topic: 'Algebraic Expressions', content: 'A difference of two squares has the form a² − b² and factorises as (a − b)(a + b). For example, x² − 16 = x² − 4² = (x − 4)(x + 4).' },
  { topic: 'Algebraic Expressions', content: 'A trinomial x² + bx + c factorises into (x + p)(x + q) where p + q = b and p × q = c. For example, x² + 7x + 12 = (x + 3)(x + 4) because 3 + 4 = 7 and 3 × 4 = 12.' },
  { topic: 'Exponents', content: 'The exponent laws include: xᵃ · xᵇ = x^(a+b), xᵃ ÷ xᵇ = x^(a−b), (xᵃ)ᵇ = x^(ab), and x⁰ = 1 for any non-zero x.' },
  { topic: 'Equations and Inequalities', content: 'To solve a linear equation, isolate the variable using inverse operations on both sides. For 2x + 6 = 14, subtract 6 to get 2x = 8, then divide by 2 to get x = 4.' },
  { topic: 'Functions and Graphs', content: 'A linear function is written y = mx + c, where m is the gradient (steepness) and c is the y-intercept (where the line crosses the y-axis). For y = 2x + 3 the gradient is 2 and the y-intercept is 3.' },
  { topic: 'Trigonometry', content: 'In a right-angled triangle the trig ratios are sin θ = opposite/hypotenuse, cos θ = adjacent/hypotenuse, and tan θ = opposite/adjacent. Special angles include sin 30° = 0.5 and cos 60° = 0.5.' },
  { topic: 'Euclidean Geometry', content: 'Angle relationships: angles on a straight line add up to 180°, angles around a point add up to 360°, and the interior angles of a triangle add up to 180°.' },
  { topic: 'Finance and Growth', content: 'Simple interest is calculated with A = P(1 + in), where P is the principal, i is the interest rate per period, and n is the number of periods. The interest earned is P × i × n.' },
];

async function main(): Promise<void> {
  // ── Clean prior copy of this subject for idempotency ──────────────────────
  const existing = await prisma.subject.findUnique({ where: { code: 'MATH-G10' } });
  if (existing) {
    await prisma.subject.delete({ where: { id: existing.id } }); // cascades topics/questions/etc.
  }
  await prisma.knowledgeChunk.deleteMany({ where: { subjectCode: 'MATH-G10' } });
  await prisma.importantDate.deleteMany({ where: { grade: 10 } });
  await prisma.career.deleteMany({
    where: { title: { in: ['Civil Engineer', 'Chartered Accountant', 'Data Scientist'] } },
  });

  // ── Subject + topics ──────────────────────────────────────────────────────
  const subject = await prisma.subject.create({
    data: { name: 'Mathematics', code: 'MATH-G10', grade: 10, weighting: 1 },
  });

  const topicByTitle = new Map<string, string>();
  for (const [i, t] of TOPICS.entries()) {
    const topic = await prisma.topic.create({
      data: {
        subjectId: subject.id,
        title: t.title,
        orderIndex: i,
        importance: t.importance,
        subtopics: { create: t.subtopics.map((s, si) => ({ title: s, orderIndex: si })) },
      },
    });
    topicByTitle.set(t.title, topic.id);
  }

  // ── Questions ─────────────────────────────────────────────────────────────
  const questionIds: string[] = [];
  const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
  for (const q of QUESTIONS) {
    const topicId = topicByTitle.get(q.topic)!;
    const created = await prisma.question.create({
      data: {
        subjectId: subject.id,
        topicId,
        type: QuestionType.MULTIPLE_CHOICE,
        difficulty: q.difficulty,
        prompt: q.prompt,
        marks: 1,
        options: { create: q.options.map(([text, isCorrect], oi) => ({ label: labels[oi], text, isCorrect })) },
      },
    });
    questionIds.push(created.id);
  }

  // ── Diagnostic test from the question bank ────────────────────────────────
  await prisma.diagnosticTest.create({
    data: {
      subjectId: subject.id,
      grade: 10,
      title: 'Grade 10 Mathematics Diagnostic',
      items: { create: questionIds.map((questionId, idx) => ({ questionId, orderIndex: idx })) },
    },
  });

  // ── Curriculum knowledge for the AI tutor ─────────────────────────────────
  await prisma.knowledgeChunk.createMany({
    data: KNOWLEDGE.map((k) => ({
      sourceType: KnowledgeSourceType.CURRICULUM,
      subjectCode: 'MATH-G10',
      grade: 10,
      topicTitle: k.topic,
      content: k.content,
      tokenCount: Math.ceil(k.content.length / 4),
    })),
  });

  // ── Careers (real APS-based requirements) ─────────────────────────────────
  await prisma.career.create({
    data: {
      title: 'Civil Engineer',
      description: 'Designs and oversees construction of infrastructure such as roads, bridges, dams and buildings.',
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
            requirements: { create: [{ subjectName: 'Mathematics', minPercent: 70 }, { subjectName: 'Physical Sciences', minPercent: 60 }, { subjectName: 'English', minPercent: 50 }] },
          },
          {
            university: 'University of Pretoria',
            programmeName: 'BEng Civil Engineering',
            minAps: 35,
            requirements: { create: [{ subjectName: 'Mathematics', minPercent: 60 }, { subjectName: 'Physical Sciences', minPercent: 60 }] },
          },
        ],
      },
    },
  });

  await prisma.career.create({
    data: {
      title: 'Chartered Accountant',
      description: 'Manages financial reporting, auditing and tax for organisations; a CA(SA) is a highly regarded qualification.',
      subjectRequirements: { create: [{ subjectName: 'Mathematics', minPercent: 60 }, { subjectName: 'Accounting', minPercent: 60 }] },
      programmes: {
        create: [
          {
            university: 'Stellenbosch University',
            programmeName: 'BAcc (Chartered Accountancy)',
            minAps: 38,
            requirements: { create: [{ subjectName: 'Mathematics', minPercent: 60 }, { subjectName: 'English', minPercent: 50 }] },
          },
        ],
      },
    },
  });

  await prisma.career.create({
    data: {
      title: 'Data Scientist',
      description: 'Uses statistics, programming and machine learning to find insights in data and build predictive models.',
      subjectRequirements: { create: [{ subjectName: 'Mathematics', minPercent: 70 }] },
      programmes: {
        create: [
          {
            university: 'University of the Witwatersrand',
            programmeName: 'BSc Computer Science & Statistics',
            minAps: 40,
            requirements: { create: [{ subjectName: 'Mathematics', minPercent: 70 }, { subjectName: 'English', minPercent: 50 }] },
          },
        ],
      },
    },
  });

  // ── Exam dates for the countdown ──────────────────────────────────────────
  await prisma.importantDate.createMany({
    data: [
      { type: 'SUBJECT_EXAM', title: 'Mathematics Trial Exam', date: new Date('2026-09-15T08:00:00Z'), subjectId: subject.id, grade: 10 },
      { type: 'EXAM_PERIOD', title: 'Final Examinations', date: new Date('2026-11-02T08:00:00Z'), grade: 10 },
      { type: 'SUBJECT_EXAM', title: 'Mathematics Paper 1', date: new Date('2026-11-04T09:00:00Z'), subjectId: subject.id, grade: 10 },
    ],
  });

  // ── Past papers (placeholder text files in local storage) ─────────────────
  await prisma.pastPaper.deleteMany({ where: { subjectId: subject.id } });
  const papers: Array<{ title: string; year: number; kind: string; body: string }> = [
    { title: 'Mathematics Paper 1', year: 2024, kind: 'Paper 1', body: 'GRADE 10 MATHEMATICS — PAPER 1 (2024)\n\nQuestion 1\n1.1 Factorise: x² − 16\n1.2 Solve for x: 2x + 6 = 14\n1.3 Simplify: x³ · x⁴\n\nQuestion 2\n2.1 Determine the gradient of y = 2x + 3\n2.2 Find the next term: 2, 5, 8, 11, …' },
    { title: 'Mathematics Paper 1 — Memo', year: 2024, kind: 'Memo', body: 'GRADE 10 MATHEMATICS — PAPER 1 MEMO (2024)\n\n1.1 (x − 4)(x + 4)\n1.2 x = 4\n1.3 x⁷\n2.1 gradient = 2\n2.2 14' },
    { title: 'Mathematics Paper 2', year: 2024, kind: 'Paper 2', body: 'GRADE 10 MATHEMATICS — PAPER 2 (2024)\n\nQuestion 1 (Trigonometry)\n1.1 Write down the value of sin 30°\n1.2 In a right-angled triangle, tan θ = opposite / ___\n\nQuestion 2 (Euclidean Geometry)\n2.1 Angles on a straight line add up to …' },
    { title: 'Mathematics Paper 1', year: 2023, kind: 'Paper 1', body: 'GRADE 10 MATHEMATICS — PAPER 1 (2023)\n\nQuestion 1\n1.1 Factorise: x² + 7x + 12\n1.2 Solve for x: x/3 = 5\n1.3 Evaluate: 5⁰' },
  ];
  await prisma.pastPaper.createMany({
    data: papers.map((p) => ({
      title: p.title,
      subjectId: subject.id,
      grade: 10,
      year: p.year,
      kind: p.kind,
      storageKey: writePaperFile(p.body),
      mimeType: 'text/plain',
    })),
  });

  // ── Enrol the demo student ────────────────────────────────────────────────
  const student = await prisma.user.findUnique({
    where: { email: 'student@demo.passpath.app' },
    include: { studentProfile: true },
  });
  if (student?.studentProfile) {
    await prisma.studentSubject.upsert({
      where: { studentId_subjectId: { studentId: student.studentProfile.id, subjectId: subject.id } },
      update: {},
      create: { studentId: student.studentProfile.id, subjectId: subject.id },
    });
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seeded ${subject.code}: ${TOPICS.length} topics, ${QUESTIONS.length} questions, ${KNOWLEDGE.length} knowledge chunks, 3 careers, 3 exam dates. Demo student enrolled.`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
