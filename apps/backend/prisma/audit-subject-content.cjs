const fs = require('node:fs');
require('dotenv').config();

const urls = fs.existsSync('.env')
  ? [...fs.readFileSync('.env', 'utf8').matchAll(/^DATABASE_URL=(.+)$/gm)]
      .map((match) => match[1].trim().replace(/^['"]|['"]$/g, ''))
  : [];
const requestedIndex = Number(process.env.AUDIT_DATABASE_INDEX ?? -1);
const databaseUrl = requestedIndex < 0
  ? (urls.at(-1) ?? process.env.DATABASE_URL)
  : urls[requestedIndex];
if (!databaseUrl) throw new Error('Configured DATABASE_URL not found');
process.env.DATABASE_URL = databaseUrl;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    WITH topic_counts AS (
      SELECT t.subject_id,
             COUNT(*)::int AS topics,
             COUNT(st.id)::int AS subtopics
      FROM topics t LEFT JOIN subtopics st ON st.topic_id = t.id
      GROUP BY t.subject_id
    ), document_counts AS (
      SELECT subject_code, grade, COUNT(*)::int AS documents
      FROM curriculum_documents GROUP BY subject_code, grade
    ), chunk_counts AS (
      SELECT subject_code, grade,
             COUNT(*)::int AS chunks,
             COUNT(DISTINCT NULLIF(topic_title, ''))::int AS "chunkTopics",
             COUNT(embedding)::int AS embedded
      FROM knowledge_chunks GROUP BY subject_code, grade
    ), paper_counts AS (
      SELECT subject_id, grade, COUNT(*)::int AS papers
      FROM past_papers GROUP BY subject_id, grade
    )
    SELECT s.grade, s.code, s.name,
           COALESCE(t.topics, 0) AS topics,
           COALESCE(t.subtopics, 0) AS subtopics,
           COALESCE(d.documents, 0) AS documents,
           COALESCE(k.chunks, 0) AS chunks,
           COALESCE(k."chunkTopics", 0) AS "chunkTopics",
           COALESCE(k.embedded, 0) AS embedded,
           COALESCE(p.papers, 0) AS papers
    FROM subjects s
    LEFT JOIN topic_counts t ON t.subject_id = s.id
    LEFT JOIN document_counts d ON d.subject_code = s.code AND d.grade = s.grade
    LEFT JOIN chunk_counts k ON k.subject_code = s.code AND k.grade = s.grade
    LEFT JOIN paper_counts p ON p.subject_id = s.id AND p.grade = s.grade
    WHERE s.grade BETWEEN 10 AND 12
    ORDER BY s.grade, s.name, s.code
  `);

  const summary = rows.reduce((result, row) => {
    const grade = `grade${row.grade}`;
    const current = result[grade] ?? { subjects: 0, withTopics: 0, withDocuments: 0, withChunks: 0, withPapers: 0 };
    current.subjects += 1;
    if (row.topics > 0) current.withTopics += 1;
    if (row.documents > 0) current.withDocuments += 1;
    if (row.chunks > 0) current.withChunks += 1;
    if (row.papers > 0) current.withPapers += 1;
    result[grade] = current;
    return result;
  }, {});

  const result = process.env.AUDIT_SUMMARY_ONLY === '1'
    ? { databaseIndex: requestedIndex, summary }
    : { databaseIndex: requestedIndex, summary, subjects: rows };
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
