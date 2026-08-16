const fs = require('node:fs');
require('dotenv').config();

if (fs.existsSync('.env')) {
  const urls = [...fs.readFileSync('.env', 'utf8').matchAll(/^DATABASE_URL=(.+)$/gm)]
    .map((match) => match[1].trim().replace(/^['"]|['"]$/g, ''));
  process.env.DATABASE_URL = urls.at(-1) ?? process.env.DATABASE_URL;
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const run = process.env.FET_TOPIC_DEDUPE_RUN === '1';

const topicReferenceTables = [
  ['subtopics', 'topic_id'],
  ['questions', 'topic_id'],
  ['tutor_conversations', 'topic_id'],
  ['lessons', 'topic_id'],
  ['weak_topic_profiles', 'topic_id'],
  ['topic_mastery', 'topic_id'],
  ['daily_missions', 'topic_id'],
];

function rankedTopicsSql(existingTables) {
  const usageTerms = topicReferenceTables
    .filter(([table]) => existingTables.has(table))
    .map(([table, column]) => `(SELECT COUNT(*) FROM ${table} r WHERE r.${column} = t.id)`);
  const usageExpression = usageTerms.length ? usageTerms.join(' +\n      ') : '0';
  return `
  WITH topic_usage AS (
    SELECT t.id,
      ${usageExpression} AS uses
    FROM topics t
    JOIN subjects s ON s.id = t.subject_id
    WHERE s.grade BETWEEN 10 AND 12
  ), ranked AS (
    SELECT t.id, t.subject_id, t.title, t.order_index, u.uses,
      ROW_NUMBER() OVER (
        PARTITION BY t.subject_id, LOWER(TRIM(t.title)), t.order_index
        ORDER BY u.uses DESC, t.created_at ASC, t.id ASC
      ) AS duplicate_rank
    FROM topics t
    JOIN subjects s ON s.id = t.subject_id
    JOIN topic_usage u ON u.id = t.id
    WHERE s.grade BETWEEN 10 AND 12
  )`;
}

async function main() {
  const tableRows = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
  `);
  const existingTables = new Set(tableRows.map((row) => row.table_name));
  const rankedSql = rankedTopicsSql(existingTables);
  const summary = await prisma.$queryRawUnsafe(`${rankedSql}
    SELECT
      COUNT(*) FILTER (WHERE duplicate_rank > 1)::int AS duplicates,
      COUNT(*) FILTER (WHERE duplicate_rank > 1 AND uses = 0)::int AS deletable,
      COUNT(*) FILTER (WHERE duplicate_rank > 1 AND uses > 0)::int AS blocked
    FROM ranked
  `);
  console.log(summary[0]);
  if (!run) {
    console.log('dry run only; set FET_TOPIC_DEDUPE_RUN=1 to apply');
    return;
  }

  const removed = await prisma.$executeRawUnsafe(`${rankedSql}
    DELETE FROM topics t
    USING ranked r
    WHERE t.id = r.id AND r.duplicate_rank > 1 AND r.uses = 0
  `);
  console.log(`removed ${removed} unused exact duplicate topic rows`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
