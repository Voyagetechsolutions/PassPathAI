import { Prisma, PrismaClient } from '@prisma/client';
import { withDbRetry } from '../src/common/utils/db-retry';

/**
 * One-off cleanup. The first past-paper run created records with ids/keys that
 * lacked a session label (e.g. `pp-ACCN-G10-2023-memo-1`). The scaled run adds a
 * session label (`pp-ACCN-G10-2023-nov-memo-1`), so the old 2023-November records
 * are now duplicates. Remove the label-less ones — every kept past-paper id now
 * contains a `-nov-` or `-june-` segment.
 *
 * KnowledgeChunk.document is onDelete:SetNull, so chunks must be deleted first or
 * they orphan (keep their embedding and stay retrievable).
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const isOld = Prisma.sql`id LIKE 'pp-%' AND id NOT LIKE 'pp-%-nov-%' AND id NOT LIKE 'pp-%-june-%'`;
  const isOldDoc = Prisma.sql`document_id LIKE 'pp-%' AND document_id NOT LIKE 'pp-%-nov-%' AND document_id NOT LIKE 'pp-%-june-%'`;

  const chunks = await withDbRetry(() =>
    prisma.$executeRaw(Prisma.sql`DELETE FROM knowledge_chunks WHERE ${isOldDoc}`),
  );
  const papers = await withDbRetry(() =>
    prisma.$executeRaw(Prisma.sql`DELETE FROM past_papers WHERE ${isOld}`),
  );
  const docs = await withDbRetry(() =>
    prisma.$executeRaw(Prisma.sql`DELETE FROM curriculum_documents WHERE ${isOld}`),
  );
  // eslint-disable-next-line no-console
  console.log(`Removed ${chunks} chunks, ${papers} past papers, ${docs} documents (label-less duplicates).`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
