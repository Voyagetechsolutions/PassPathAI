require('dotenv').config();
const fs = require('node:fs');
const configuredUrls = [...fs.readFileSync('.env', 'utf8').matchAll(/^DATABASE_URL=(.+)$/gm)]
  .map((match) => match[1].trim().replace(/^['"]|['"]$/g, ''));
process.env.DATABASE_URL = configuredUrls.at(-1);
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const names = {
  ACCN: 'Accounting', AFR: 'Afrikaans', AGRI: 'Agricultural Sciences',
  AGRM: 'Agricultural Management Practices', AGRT: 'Agricultural Technology', BSTD: 'Business Studies',
  CART: 'Creative Arts', CAT: 'Computer Applications Technology', CIVT: 'Civil Technology', CODE: 'Coding and Robotics',
  CONS: 'Consumer Studies', DANC: 'Dance Studies', DRAM: 'Dramatic Arts', DSGN: 'Design Studies',
  ECON: 'Economics', ELET: 'Electrical Technology', EMS: 'Economic and Management Sciences',
  ENFAL: 'English First Additional Language', ENG: 'English', EQUI: 'Equine Studies', GEOG: 'Geography',
  HIST: 'History', HOSP: 'Hospitality Studies', IT: 'Information Technology', LFOR: 'Life Orientation',
  LIFE: 'Life Sciences', MARE: 'Maritime Economics', MARI: 'Marine Sciences', MATH: 'Mathematics',
  MECT: 'Mechanical Technology', MLIT: 'Mathematical Literacy', MUSC: 'Music', NATSCI: 'Natural Sciences',
  NAUT: 'Nautical Science', NBL: 'isiNdebele', NSO: 'Sepedi', PHSC: 'Physical Sciences',
  RELS: 'Religion Studies', SOCSCI: 'Social Sciences', SOT: 'Sesotho', SPRT: 'Sport and Exercise Science',
  SSW: 'Siswati', TECH: 'Technology', TMATH: 'Technical Mathematics', TOUR: 'Tourism',
  TSCI: 'Technical Sciences', TSO: 'Tsonga', TSW: 'Setswana', VART: 'Visual Arts',
  VEN: 'Tshivenda', XHO: 'isiXhosa', ZUL: 'isiZulu',
};

async function duplicatePhase(sourceGrade, targetGrade) {
  const suffix = `g${targetGrade}`;
  const count = await prisma.$executeRawUnsafe(`
    INSERT INTO knowledge_chunks
      (id, document_id, source_type, subject_code, grade, topic_title, content, embedding, token_count, created_at)
    SELECT id || '-${suffix}', document_id, source_type,
           regexp_replace(subject_code, '-G[0-9]+$', '-G${targetGrade}'), ${targetGrade},
           topic_title, content, embedding, token_count, created_at
    FROM knowledge_chunks
    WHERE grade = ${sourceGrade} AND source_type = 'CURRICULUM' AND id NOT LIKE '%-g%'
    ON CONFLICT (id) DO NOTHING`);
  console.log(`grade ${targetGrade} phase chunks added: ${count}`);
}

async function main() {
  // Two historical aliases represented the same English FAL subject.
  await prisma.$executeRawUnsafe(`UPDATE knowledge_chunks SET subject_code = replace(subject_code, 'ENG-FAL-', 'ENFAL-') WHERE subject_code LIKE 'ENG-FAL-%'`);
  await prisma.$executeRawUnsafe(`
    UPDATE knowledge_chunks
    SET subject_code = regexp_replace(subject_code, '-G[0-9]+$', '-G' || grade::text)
    WHERE subject_code IS NOT NULL AND grade IS NOT NULL`);
  await duplicatePhase(9, 8);
  await duplicatePhase(10, 11);
  await duplicatePhase(10, 12);

  const coverage = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT subject_code AS code, grade FROM knowledge_chunks
    WHERE subject_code IS NOT NULL AND grade BETWEEN 8 AND 12 ORDER BY grade, subject_code`);
  let created = 0;
  for (const item of coverage) {
    if (await prisma.subject.findUnique({ where: { code: item.code }, select: { id: true } })) continue;
    const prefix = item.code.replace(/-G[0-9]+$/, '').split('-')[0];
    let name = names[prefix] || prefix;
    if (item.code.includes('-FAL-')) name += ' First Additional Language';
    if (item.code.includes('-HL-')) name += ' Home Language';
    const sameName = await prisma.subject.findFirst({ where: { name, grade: item.grade }, select: { id: true } });
    if (sameName) continue;
    await prisma.subject.create({ data: { name, code: item.code, grade: item.grade } });
    created += 1;
  }
  console.log(`subject-grade records created: ${created}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
