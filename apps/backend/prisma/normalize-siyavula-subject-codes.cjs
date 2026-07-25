require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const documents = await prisma.$executeRawUnsafe(`
    UPDATE curriculum_documents
    SET subject_code = CASE
      WHEN id LIKE 'siyavula-MATH-%' THEN 'MATH-G' || grade::text
      WHEN id LIKE 'siyavula-PHSC-%' THEN 'PHSC-G' || grade::text
      ELSE subject_code
    END
    WHERE id LIKE 'siyavula-%'
  `);
  const chunks = await prisma.$executeRawUnsafe(`
    UPDATE knowledge_chunks
    SET subject_code = CASE
      WHEN document_id LIKE 'siyavula-MATH-%' THEN 'MATH-G' || grade::text
      WHEN document_id LIKE 'siyavula-PHSC-%' THEN 'PHSC-G' || grade::text
      ELSE subject_code
    END
    WHERE document_id LIKE 'siyavula-%'
  `);
  console.log(`normalised ${documents} Siyavula documents and ${chunks} chunks`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
