import { Prisma, PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { withDbRetry } from '../src/common/utils/db-retry';

// @prisma/client loads .env into process.env on import, so the OpenAI key is available.
const prisma = new PrismaClient();
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
const BATCH = 100;

function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}

async function main(): Promise<void> {
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment');
  }
  const openai = new OpenAI({ apiKey });

  const [{ count }] = await withDbRetry(() =>
    prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`SELECT COUNT(*)::bigint AS count FROM knowledge_chunks WHERE embedding IS NULL`,
    ),
  );
  // eslint-disable-next-line no-console
  console.log(`${count} chunks need embeddings (model: ${model})`);

  let total = 0;
  for (let i = 0; i < 100_000; i += 1) {
    const pending = await withDbRetry(() =>
      prisma.$queryRaw<Array<{ id: string; content: string }>>(
        Prisma.sql`SELECT id, content FROM knowledge_chunks WHERE embedding IS NULL LIMIT ${BATCH}`,
      ),
    );
    if (pending.length === 0) {
      break;
    }
    const res = await openai.embeddings.create({ model, input: pending.map((c) => c.content) });
    const rows = pending.map(
      (c, idx) => Prisma.sql`(${c.id}, ${toVectorLiteral(res.data[idx].embedding)}::vector)`,
    );
    await withDbRetry(() =>
      prisma.$executeRaw(
        Prisma.sql`UPDATE knowledge_chunks AS k SET embedding = v.emb
                   FROM (VALUES ${Prisma.join(rows)}) AS v(id, emb)
                   WHERE k.id = v.id`,
      ),
    );
    total += pending.length;
    // eslint-disable-next-line no-console
    console.log(`  embedded ${total}/${count}`);
  }
  // eslint-disable-next-line no-console
  console.log(`Done. Embedded ${total} chunks.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
