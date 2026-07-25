require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const documents = await prisma.$executeRawUnsafe(`
    UPDATE curriculum_documents
    SET storage_key = replace(storage_key, chr(92), '/')
    WHERE position(chr(92) in storage_key) > 0
  `);
  const papers = await prisma.$executeRawUnsafe(`
    UPDATE past_papers
    SET storage_key = replace(storage_key, chr(92), '/')
    WHERE position(chr(92) in storage_key) > 0
  `);
  console.log(`normalised ${documents} curriculum keys and ${papers} paper keys`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
