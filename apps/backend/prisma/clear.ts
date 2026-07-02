import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Clears ALL data (curriculum, questions, attempts, mastery, careers, AI chunks,
 * users, etc.) for a clean slate, then recreates the three demo accounts with NO
 * sample performance data. Real curriculum/content is added by an admin afterwards.
 */
async function main(): Promise<void> {
  // Truncate every application table (keep Prisma's migration history).
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `;
  if (tables.length > 0) {
    const list = tables.map((t) => `"${t.tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
  // eslint-disable-next-line no-console
  console.log(`Cleared ${tables.length} tables.`);

  // Recreate clean demo accounts (no mastery/streak/missions/careers/curriculum).
  const student = await prisma.user.create({
    data: {
      email: 'student@demo.passpath.app',
      firebaseUid: 'demo-student',
      role: Role.student,
      emailVerified: true,
      studentProfile: { create: { firstName: 'Demo', surname: 'Student', grade: 10 } },
    },
    include: { studentProfile: true },
  });

  const parent = await prisma.user.create({
    data: {
      email: 'parent@demo.passpath.app',
      firebaseUid: 'demo-parent',
      role: Role.parent,
      emailVerified: true,
      parentProfile: { create: { firstName: 'Demo', surname: 'Parent' } },
    },
    include: { parentProfile: true },
  });

  await prisma.user.create({
    data: {
      email: 'admin@demo.passpath.app',
      firebaseUid: 'demo-admin',
      role: Role.admin,
      emailVerified: true,
    },
  });

  if (student.studentProfile && parent.parentProfile) {
    await prisma.parentChild.create({
      data: { parentId: parent.parentProfile.id, studentId: student.studentProfile.id },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Recreated clean demo accounts (no sample data). Password = $DEMO_PASSWORD.');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
