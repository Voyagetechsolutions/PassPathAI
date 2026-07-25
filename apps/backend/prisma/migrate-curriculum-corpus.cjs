const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');

const envText = fs.readFileSync('.env', 'utf8');
const values = (key) => [...envText.matchAll(new RegExp(`^${key}=(.+)$`, 'gm'))]
  .map((match) => match[1].trim().replace(/^['"]|['"]$/g, ''));
const oldUrl = values('DATABASE_URL')[0];
const newUrl = values('DIRECT_URL').at(-1);
if (!oldUrl || !newUrl || oldUrl === newUrl) throw new Error('Distinct old and new database URLs are required');

const oldDb = new PrismaClient({ datasources: { db: { url: oldUrl } } });
const newDb = new PrismaClient({ datasources: { db: { url: newUrl } } });
const BATCH = 500;

async function copyModel(name, oldModel, newModel) {
  const rows = await oldModel.findMany();
  if (rows.length) await newModel.createMany({ data: rows, skipDuplicates: true });
  console.log(`${name}: ${rows.length}`);
}

async function copyChunks() {
  let cursor = '';
  let copied = 0;
  while (true) {
    const rows = await oldDb.$queryRawUnsafe(`
      SELECT id, document_id AS "documentId", source_type::text AS "sourceType",
             subject_code AS "subjectCode", grade, topic_title AS "topicTitle",
             content, token_count AS "tokenCount", created_at AS "createdAt",
             CASE WHEN embedding IS NULL THEN NULL ELSE subvector(embedding, 1, 256)::text END AS embedding
      FROM knowledge_chunks WHERE id > $1 ORDER BY id LIMIT ${BATCH}`, cursor);
    if (!rows.length) break;
    await newDb.knowledgeChunk.createMany({
      data: rows.map(({ embedding, ...row }) => row),
      skipDuplicates: true,
    });
    const embedded = rows.filter((row) => row.embedding);
    if (embedded.length) {
      const params = [];
      const placeholders = embedded.map((row, index) => {
        params.push(row.id, row.embedding);
        return `($${index * 2 + 1}, $${index * 2 + 2})`;
      });
      await newDb.$executeRawUnsafe(`
        UPDATE knowledge_chunks AS chunk SET embedding = values.embedding::vector(256)
        FROM (VALUES ${placeholders.join(',')}) AS values(id, embedding)
        WHERE chunk.id = values.id`, ...params);
    }
    cursor = rows.at(-1).id;
    copied += rows.length;
    console.log(`knowledge chunks: ${copied}`);
  }
}

async function main() {
  await copyModel('subjects', oldDb.subject, newDb.subject);
  await copyModel('topics', oldDb.topic, newDb.topic);
  await copyModel('subtopics', oldDb.subtopic, newDb.subtopic);
  await copyModel('curriculum documents', oldDb.curriculumDocument, newDb.curriculumDocument);
  await copyChunks();
}

main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await Promise.all([oldDb.$disconnect(), newDb.$disconnect()]); });
