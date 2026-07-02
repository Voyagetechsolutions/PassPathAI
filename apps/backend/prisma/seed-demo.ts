import { KnowledgeSourceType, PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Demo seed: three ready-to-use accounts plus enough data to make the dashboards
 * meaningful. Pairs with dev auth (ENABLE_DEV_AUTH=true) so you can log in with a
 * password and no Firebase project. Idempotent — safe to re-run.
 *
 *   student@demo.passpath.app  (student, Grade 10)
 *   parent@demo.passpath.app   (parent, linked to the student)
 *   admin@demo.passpath.app    (admin)
 *   password for all:          $DEMO_PASSWORD (default "passpath-demo")
 */
async function main(): Promise<void> {
  // ── Curriculum scaffold ──────────────────────────────────────────────────
  const subject = await prisma.subject.upsert({
    where: { code: 'MATH-G10' },
    update: {},
    create: { name: 'Mathematics', code: 'MATH-G10', grade: 10, weighting: 1 },
  });

  const algebra = await prisma.topic.upsert({
    where: { id: 'demo-topic-algebra' },
    update: {},
    create: {
      id: 'demo-topic-algebra',
      subjectId: subject.id,
      title: 'Algebraic Expressions',
      orderIndex: 1,
      importance: 1,
    },
  });
  const geometry = await prisma.topic.upsert({
    where: { id: 'demo-topic-geometry' },
    update: {},
    create: {
      id: 'demo-topic-geometry',
      subjectId: subject.id,
      title: 'Euclidean Geometry',
      orderIndex: 2,
      importance: 0.8,
    },
  });

  // ── Accounts ─────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.passpath.app' },
    update: { role: Role.admin, isActive: true },
    create: {
      email: 'admin@demo.passpath.app',
      firebaseUid: 'demo-admin',
      role: Role.admin,
      emailVerified: true,
    },
  });

  // ── Knowledge base for the grounded AI engine ────────────────────────────
  // A demo curriculum document + chunks so /ai/ask has real material to ground
  // on after embeddings are backfilled (POST /ai/embeddings/backfill).
  const doc = await prisma.curriculumDocument.upsert({
    where: { id: 'demo-doc-algebra' },
    update: {},
    create: {
      id: 'demo-doc-algebra',
      title: 'CAPS Grade 10 Mathematics — Algebraic Expressions (demo)',
      subjectCode: 'MATH-G10',
      grade: 10,
      storageKey: 'demo/algebra.txt',
      mimeType: 'text/plain',
      ingested: true,
    },
  });
  await prisma.knowledgeChunk.deleteMany({ where: { documentId: doc.id } });
  const chunks = [
    'A difference of two squares has the form a² − b² and factorises as (a − b)(a + b). For example, x² − 9 = x² − 3² = (x − 3)(x + 3).',
    'To factorise by taking out a common factor, find the highest common factor of all the terms and write it outside the bracket. For example, 6x² + 9x = 3x(2x + 3).',
    'A trinomial of the form x² + bx + c factorises into (x + p)(x + q) where p + q = b and p × q = c. For example, x² + 5x + 6 = (x + 2)(x + 3).',
  ];
  await prisma.knowledgeChunk.createMany({
    data: chunks.map((content) => ({
      documentId: doc.id,
      sourceType: KnowledgeSourceType.CURRICULUM,
      subjectCode: 'MATH-G10',
      grade: 10,
      topicTitle: 'Algebraic Expressions',
      content,
      tokenCount: Math.ceil(content.length / 4),
    })),
  });

  const studentUser = await prisma.user.upsert({
    where: { email: 'student@demo.passpath.app' },
    update: { role: Role.student, isActive: true },
    create: {
      email: 'student@demo.passpath.app',
      firebaseUid: 'demo-student',
      role: Role.student,
      emailVerified: true,
      studentProfile: {
        create: { firstName: 'Thabo', surname: 'Mokoena', grade: 10, school: 'Demo High', province: 'GAUTENG' },
      },
    },
    include: { studentProfile: true },
  });
  const studentProfile =
    studentUser.studentProfile ??
    (await prisma.studentProfile.findUniqueOrThrow({ where: { userId: studentUser.id } }));
  const studentId = studentProfile.id;

  const parentUser = await prisma.user.upsert({
    where: { email: 'parent@demo.passpath.app' },
    update: { role: Role.parent, isActive: true },
    create: {
      email: 'parent@demo.passpath.app',
      firebaseUid: 'demo-parent',
      role: Role.parent,
      emailVerified: true,
      parentProfile: { create: { firstName: 'Naledi', surname: 'Mokoena' } },
    },
    include: { parentProfile: true },
  });
  const parentProfile =
    parentUser.parentProfile ??
    (await prisma.parentProfile.findUniqueOrThrow({ where: { userId: parentUser.id } }));

  // ── Relationships + learning data ────────────────────────────────────────
  await prisma.studentSubject.upsert({
    where: { studentId_subjectId: { studentId, subjectId: subject.id } },
    update: {},
    create: { studentId, subjectId: subject.id },
  });

  await prisma.parentChild.upsert({
    where: { parentId_studentId: { parentId: parentProfile.id, studentId } },
    update: {},
    create: { parentId: parentProfile.id, studentId },
  });

  // Mastery: strong on geometry, weak on algebra.
  await prisma.topicMastery.upsert({
    where: { studentId_topicId: { studentId, topicId: geometry.id } },
    update: { attempts: 10, correct: 9, masteryScore: 0.9, weaknessScore: 0.1 },
    create: { studentId, topicId: geometry.id, attempts: 10, correct: 9, masteryScore: 0.9, weaknessScore: 0.1 },
  });
  await prisma.topicMastery.upsert({
    where: { studentId_topicId: { studentId, topicId: algebra.id } },
    update: { attempts: 10, correct: 4, masteryScore: 0.4, weaknessScore: 0.6 },
    create: { studentId, topicId: algebra.id, attempts: 10, correct: 4, masteryScore: 0.4, weaknessScore: 0.6 },
  });
  await prisma.weakTopicProfile.upsert({
    where: { studentId_topicId: { studentId, topicId: algebra.id } },
    update: { weaknessScore: 0.6, source: 'diagnostic' },
    create: { studentId, topicId: algebra.id, weaknessScore: 0.6, source: 'diagnostic' },
  });

  await prisma.studyStreak.upsert({
    where: { studentId },
    update: { currentStreak: 4, longestStreak: 9, lastActiveDate: new Date() },
    create: { studentId, currentStreak: 4, longestStreak: 9, lastActiveDate: new Date() },
  });

  // Prediction history (refresh each run).
  await prisma.predictionSnapshot.deleteMany({ where: { studentId } });
  const day = 86_400_000;
  await prisma.predictionSnapshot.createMany({
    data: [
      { studentId, predictedScore: 58, confidence: 0.5, createdAt: new Date(Date.now() - 14 * day) },
      { studentId, predictedScore: 63, confidence: 0.6, createdAt: new Date(Date.now() - 7 * day) },
      { studentId, predictedScore: 67, confidence: 0.7, createdAt: new Date() },
    ],
  });

  // A current study plan with a couple of missions.
  await prisma.studyPlan.deleteMany({ where: { studentId } });
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  await prisma.studyPlan.create({
    data: {
      studentId,
      startDate: start,
      endDate: new Date(start.getTime() + 13 * day),
      weeklyPlans: { create: [{ weekNumber: 1, focus: 'Focus: Algebraic Expressions' }] },
      missions: {
        create: [
          { topicId: algebra.id, date: start, title: 'Revise: Algebraic Expressions', description: 'Prioritised: flagged as a weak topic.', priority: 78 },
          { topicId: geometry.id, date: start, title: 'Revise: Euclidean Geometry', description: 'Scheduled for steady revision.', priority: 40 },
        ],
      },
    },
  });

  // eslint-disable-next-line no-console
  console.log(
    [
      'Demo accounts ready (password = $DEMO_PASSWORD, default "passpath-demo"):',
      `  student@demo.passpath.app  (id ${studentUser.id})`,
      `  parent@demo.passpath.app   (id ${parentUser.id})`,
      `  admin@demo.passpath.app    (id ${admin.id})`,
    ].join('\n'),
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
