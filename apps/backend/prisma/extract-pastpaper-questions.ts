import { NestFactory } from '@nestjs/core';
import { Difficulty, KnowledgeSourceType, QuestionType } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infra/prisma/prisma.service';
import { OpenAiService } from '../src/infra/openai/openai.service';

/**
 * Structured intelligence from past papers: AI-extract real exam questions
 * (prompt + marks + model answer) from the ingested past-paper + memo text and
 * store them as Question records linked to topics. The PDF is the source; the
 * structured questions are the asset.
 *
 *   PP_SUBJECTS=MATH-G10 PP_COUNT=10 npm run db:extract:papers
 */
const SUBJECTS = (process.env.PP_SUBJECTS ?? 'MATH-G10').split(',').map((s) => s.trim()).filter(Boolean);
const PER_SUBJECT = parseInt(process.env.PP_COUNT ?? '10', 10);

/** Strip NUL bytes (Postgres text rejects them) without touching normal spaces. */
const clean = (s: string): string => s.split(String.fromCharCode(0)).join('').trim();

interface Extracted {
  topic?: string;
  prompt?: string;
  marks?: number;
  modelAnswer?: string;
}

const SYSTEM = `You are a CAPS exam analyst. From the PAST PAPER text and its MARKING MEMO, extract distinct, self-contained exam questions.
RULES:
1. Each question must stand alone — include any data/values it needs. Skip cover pages, instructions and rubrics.
2. Use the MEMO to write a concise, correct model answer for each.
3. Give the marks (integer) and the single best CAPS topic it tests.
Return ONLY JSON: { "questions": [ { "topic": string, "prompt": string, "marks": number, "modelAnswer": string } ] }.`;

function matchTopic(topics: Array<{ id: string; title: string }>, hint?: string): string {
  const h = (hint ?? '').toLowerCase();
  const found = topics.find((t) => h && (t.title.toLowerCase().includes(h) || h.includes(t.title.toLowerCase())));
  return (found ?? topics[0]).id;
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const openai = app.get(OpenAiService, { strict: false });

  let total = 0;
  for (const code of SUBJECTS) {
    const subject = await prisma.subject.findUnique({
      where: { code },
      include: { topics: { select: { id: true, title: true } } },
    });
    if (!subject || subject.topics.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`skip ${code} (no subject/topics)`);
      continue;
    }
    const [papers, memos] = await Promise.all([
      prisma.knowledgeChunk.findMany({ where: { subjectCode: code, sourceType: KnowledgeSourceType.PAST_PAPER }, take: 24, select: { id: true, content: true } }),
      prisma.knowledgeChunk.findMany({ where: { subjectCode: code, sourceType: KnowledgeSourceType.MARKING_GUIDE }, take: 24, select: { id: true, content: true } }),
    ]);
    if (papers.length === 0 && memos.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`skip ${code} (no past-paper/memo chunks)`);
      continue;
    }
    const context = `PAST PAPER:\n${papers.map((p) => p.content).join('\n')}\n\nMARKING MEMO:\n${memos.map((m) => m.content).join('\n')}`.slice(0, 12000);

    let extracted: Extracted[] = [];
    try {
      const res = await openai.chatJson<{ questions?: Extracted[] }>(SYSTEM, `${context}\n\nExtract up to ${PER_SUBJECT} questions.`);
      extracted = (res.questions ?? []).filter((q) => q.prompt && q.modelAnswer);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`${code}: extraction failed — ${(e as Error).message}`);
      continue;
    }

    // Idempotent: clear prior past-paper extractions for this subject.
    await prisma.question.deleteMany({
      where: { subjectId: subject.id, type: QuestionType.EXAM_STYLE, difficulty: Difficulty.HARD, aiGenerated: true },
    });

    const sourceChunkId = papers[0]?.id ?? memos[0]?.id ?? null;
    let made = 0;
    for (const q of extracted.slice(0, PER_SUBJECT)) {
      await prisma.question.create({
        data: {
          subjectId: subject.id,
          topicId: matchTopic(subject.topics, q.topic),
          type: QuestionType.EXAM_STYLE,
          difficulty: Difficulty.HARD,
          prompt: clean(q.prompt ?? ''),
          modelAnswer: clean(q.modelAnswer ?? ''),
          marks: q.marks && q.marks > 0 ? Math.round(q.marks) : 3,
          aiGenerated: true,
          sourceChunkId,
        },
      });
      made += 1;
    }
    total += made;
    // eslint-disable-next-line no-console
    console.log(`${code}: extracted ${made} past-paper questions`);
  }
  // eslint-disable-next-line no-console
  console.log(`\nExtracted ${total} structured past-paper questions.`);
  await app.close();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
