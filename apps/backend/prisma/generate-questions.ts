import { NestFactory } from '@nestjs/core';
import { Difficulty, QuestionType } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { QuestionGenerationService } from '../src/modules/question-generation/question-generation.service';

/**
 * Bulk-generate grounded MCQs for the topics of the given subjects, reusing the
 * real QuestionGenerationService (vector-grounded). Idempotent: skips any topic
 * that already has >= GEN_COUNT AI questions.
 *
 *   GEN_SUBJECTS=LIFE-G10,PHSC-G10 GEN_COUNT=3 npm run db:generate:questions
 */
const SUBJECTS = (process.env.GEN_SUBJECTS ?? 'LIFE-G10').split(',').map((s) => s.trim()).filter(Boolean);
const COUNT = parseInt(process.env.GEN_COUNT ?? '3', 10);
const TYPE = (process.env.GEN_TYPE as QuestionType) ?? QuestionType.MULTIPLE_CHOICE;
const DIFFICULTY = (process.env.GEN_DIFFICULTY as Difficulty) ?? Difficulty.MEDIUM;

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const gen = app.get(QuestionGenerationService, { strict: false });

  let total = 0;
  for (const code of SUBJECTS) {
    const subject = await prisma.subject.findUnique({ where: { code }, include: { topics: { orderBy: { orderIndex: 'asc' } } } });
    if (!subject) {
      // eslint-disable-next-line no-console
      console.log(`no subject for code ${code}`);
      continue;
    }
    // eslint-disable-next-line no-console
    console.log(`\n=== ${code} ${subject.name} — ${subject.topics.length} topics`);
    for (const topic of subject.topics) {
      if (process.env.GEN_FORCE === '1') {
        await prisma.question.deleteMany({ where: { topicId: topic.id, aiGenerated: true, type: TYPE, difficulty: DIFFICULTY } });
      }
      const existing = await prisma.question.count({ where: { topicId: topic.id, aiGenerated: true, type: TYPE, difficulty: DIFFICULTY } });
      if (existing >= COUNT) {
        // eslint-disable-next-line no-console
        console.log(`  skip "${topic.title}" (has ${existing} ${TYPE})`);
        continue;
      }
      try {
        const r = await gen.generate({
          topicId: topic.id,
          type: TYPE,
          difficulty: DIFFICULTY,
          count: COUNT,
        });
        total += r.generated;
        // eslint-disable-next-line no-console
        console.log(`  + ${r.generated} for "${topic.title}"`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log(`  ✗ "${topic.title}": ${(e as Error).message}`);
      }
    }
  }
  // eslint-disable-next-line no-console
  console.log(`\nGenerated ${total} questions across ${SUBJECTS.length} subject(s).`);
  await app.close();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
