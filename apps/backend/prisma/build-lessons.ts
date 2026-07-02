import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { LessonsService } from '../src/modules/lessons/lessons.service';

/**
 * Build the owned lesson library: draft + store one structured lesson per topic
 * for the given subjects. Idempotent (skips topics that already have a lesson;
 * LESSON_FORCE=1 re-drafts). Start deep on one subject (Mathematics flagship).
 *
 *   LESSON_SUBJECTS=MATH-G10 npm run db:build:lessons
 */
const SUBJECTS = (process.env.LESSON_SUBJECTS ?? 'MATH-G10').split(',').map((s) => s.trim()).filter(Boolean);
const FORCE = process.env.LESSON_FORCE === '1';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const lessons = app.get(LessonsService, { strict: false });

  let built = 0;
  for (const code of SUBJECTS) {
    const subject = await prisma.subject.findUnique({
      where: { code },
      include: { topics: { orderBy: { orderIndex: 'asc' }, include: { lesson: true } } },
    });
    if (!subject) {
      // eslint-disable-next-line no-console
      console.log(`no subject for ${code}`);
      continue;
    }
    // eslint-disable-next-line no-console
    console.log(`\n=== ${code} ${subject.name} — ${subject.topics.length} topics`);
    for (const topic of subject.topics) {
      if (topic.lesson && !FORCE) {
        // eslint-disable-next-line no-console
        console.log(`  skip "${topic.title}" (lesson exists)`);
        continue;
      }
      try {
        await lessons.generateAndStore(topic.id);
        built += 1;
        // eslint-disable-next-line no-console
        console.log(`  + lesson: "${topic.title}"`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log(`  x "${topic.title}": ${(e as Error).message}`);
      }
    }
  }
  // eslint-disable-next-line no-console
  console.log(`\nBuilt ${built} lessons across ${SUBJECTS.length} subject(s).`);
  await app.close();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
