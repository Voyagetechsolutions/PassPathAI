require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const seniorAndEleven = await prisma.$executeRawUnsafe(
    `UPDATE knowledge_chunks
     SET subject_code = replace(subject_code, 'ENFAL-', 'ENG-FAL-')
     WHERE subject_code LIKE 'ENFAL-%' AND grade IN (8, 9, 11)`,
  );
  const fetAliases = await prisma.$executeRawUnsafe(
    `UPDATE knowledge_chunks
     SET subject_code = replace(subject_code, 'ENG-FAL-', 'ENFAL-')
     WHERE subject_code LIKE 'ENG-FAL-%' AND grade IN (10, 12)`,
  );
  console.log(
    `normalised ${seniorAndEleven + fetAliases} English FAL chunks to the existing subject catalogue`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
