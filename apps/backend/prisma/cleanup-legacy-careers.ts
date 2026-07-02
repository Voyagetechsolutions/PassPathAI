import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Remove legacy careers from the original small seed (they have no faculty set);
 *  the curated ~100-career seed all carry a faculty. One-off cleanup. */
async function main(): Promise<void> {
  for (let i = 1; i <= 12; i += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  const res = await prisma.career.deleteMany({ where: { faculty: null } });
  const total = await prisma.career.count();
  // eslint-disable-next-line no-console
  console.log(`Deleted ${res.count} legacy careers. Remaining: ${total}.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
