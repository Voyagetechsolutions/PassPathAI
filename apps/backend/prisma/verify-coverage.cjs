const fs = require('node:fs');
require('dotenv').config();
const urls = [...fs.readFileSync('.env', 'utf8').matchAll(/^DATABASE_URL=(.+)$/gm)]
  .map((match) => match[1].trim().replace(/^['"]|['"]$/g, ''));
process.env.DATABASE_URL = urls.at(-1);
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
Promise.all([
  prisma.$queryRawUnsafe(`SELECT pg_database_size(current_database())::bigint AS bytes`),
  prisma.$queryRawUnsafe(`SELECT grade, COUNT(*)::bigint AS chunks, COUNT(embedding)::bigint AS embedded, COUNT(DISTINCT subject_code)::bigint AS subjects FROM knowledge_chunks GROUP BY grade ORDER BY grade`),
  prisma.$queryRawUnsafe(`SELECT grade, COUNT(*)::bigint AS subjects FROM subjects GROUP BY grade ORDER BY grade`),
  prisma.$queryRawUnsafe(`SELECT COUNT(*)::bigint AS rewards FROM reward_definitions`),
  prisma.$queryRawUnsafe(`SELECT DISTINCT k.subject_code, k.grade FROM knowledge_chunks k LEFT JOIN subjects s ON s.code = k.subject_code WHERE k.grade BETWEEN 8 AND 12 AND s.id IS NULL ORDER BY k.grade, k.subject_code`),
]).then((result) => console.log(JSON.stringify(result, (_, value) => typeof value === 'bigint' ? Number(value) : value, 2)))
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
