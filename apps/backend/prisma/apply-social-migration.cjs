require('dotenv').config();
process.env.DATABASE_URL = process.env.DIRECT_URL;
const fs = require('node:fs');
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const migrationName = '20260715170000_social_rewards';
const sql = fs.readFileSync(`prisma/migrations/${migrationName}/migration.sql`, 'utf8');
const checksum = crypto.createHash('sha256').update(sql).digest('hex');
const statements = sql.split(';').map((part) => part.trim()).filter(Boolean);

prisma.$transaction(async (tx) => {
  const existing = await tx.$queryRawUnsafe('SELECT 1 FROM _prisma_migrations WHERE migration_name = $1', migrationName);
  if (existing.length) return;
  for (const statement of statements) await tx.$executeRawUnsafe(statement);
  await tx.$executeRawUnsafe(`
    INSERT INTO _prisma_migrations
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
    VALUES ($1, $2, NOW(), $3, NULL, NULL, NOW(), 1)`, crypto.randomUUID(), checksum, migrationName);
}, { timeout: 60000 }).then(() => console.log('Social migration applied.'))
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
