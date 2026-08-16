const fs = require('node:fs');
require('dotenv').config();

if (fs.existsSync('.env')) {
  const urls = [...fs.readFileSync('.env', 'utf8').matchAll(/^DATABASE_URL=(.+)$/gm)]
    .map((match) => match[1].trim().replace(/^['"]|['"]$/g, ''));
  process.env.DATABASE_URL = urls.at(-1) ?? process.env.DATABASE_URL;
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const run = process.env.FET_TOPIC_SEED_RUN === '1';

const LANGUAGE_TOPICS = [
  'Listening and speaking',
  'Reading and viewing: comprehension and visual literacy',
  'Literature: poetry, prose and drama',
  'Writing and presenting: essays',
  'Writing and presenting: transactional texts',
  'Language structures and conventions',
];

// Broad CAPS FET curriculum strands used only where a curated topic tree does
// not already exist. These keep every subject navigable while the AI grounds
// answers in that subject's ingested CAPS document and grade metadata.
const TOPICS = {
  AGRM: ['Crop production and management', 'Animal production and management', 'Natural resource management', 'Farm planning and record keeping', 'Agricultural economics and marketing', 'Machinery, buildings and infrastructure', 'Data collection and agricultural research'],
  AGRT: ['Safety, measurements and technical skills', 'Structural materials and construction', 'Mechanical systems and machinery', 'Electrical energy and control', 'Soil, water supply and irrigation', 'Alternative energy in agriculture', 'Technical drawings and project work'],
  CIVT: ['Occupational health and safety', 'Materials, tools and equipment', 'Graphics and communication', 'Construction processes', 'Surveying and setting out', 'Civil services and infrastructure', 'Sustainable construction'],
  CONS: ['The consumer and consumer rights', 'Food and nutrition', 'Food production and practical skills', 'Clothing and textiles', 'Housing and interior resources', 'Entrepreneurship and production', 'Resource management and sustainability'],
  DANC: ['Dance performance and technique', 'Improvisation and choreography', 'Dance theory and terminology', 'Dance history and appreciation', 'Anatomy, health and safe practice', 'Music and production for dance'],
  DSGN: ['The design process', 'Visual communication', 'Design elements and principles', 'Materials, methods and production', 'Design history and context', 'Design in a social and environmental context', 'Design business and presentation'],
  DRAM: ['Performance skills and improvisation', 'Voice and body', 'Text interpretation and characterisation', 'Theatre history and movements', 'South African theatre', 'Directing, staging and technical theatre', 'Drama in media and society'],
  ELET: ['Occupational health and safety', 'Tools, instruments and measurements', 'Electrical principles and circuits', 'Digital electronics', 'Power systems and machines', 'Electronic control systems', 'Installation, testing and fault finding'],
  EQUI: ['Equine anatomy and physiology', 'Horse behaviour and handling', 'Nutrition and feeding', 'Stable and pasture management', 'Health, diseases and first aid', 'Breeding and reproduction', 'Equine industry and business management'],
  HOSP: ['Hospitality sectors and careers', 'Nutrition and menu planning', 'Food commodities and preparation', 'Kitchen operations and food safety', 'Restaurant service', 'Accommodation and housekeeping', 'Costing, marketing and entrepreneurship'],
  MARI: ['Ocean systems and oceanography', 'Marine biodiversity', 'Marine ecology', 'Marine resources and conservation', 'Human impact on marine environments', 'Marine research and data handling', 'South African coastal systems'],
  MARE: ['The maritime economy', 'Shipping and international trade', 'Ports, terminals and logistics', 'Maritime geography and routes', 'Maritime finance and insurance', 'Maritime law, safety and regulation', 'Sustainable maritime development'],
  MECT: ['Occupational health and safety', 'Materials, tools and measurements', 'Mechanical drawings and communication', 'Forces, motion and power', 'Joining and manufacturing processes', 'Engines and mechanical systems', 'Hydraulics, pneumatics and maintenance'],
  MUSC: ['Music performance', 'Music literacy and theory', 'Aural training', 'Composition and arrangement', 'Music history and analysis', 'African and South African music', 'Music technology and the music industry'],
  NAUT: ['Navigation principles and charts', 'Seamanship', 'Marine meteorology', 'Ship construction and stability', 'Marine communication', 'Safety, survival and emergency procedures', 'Maritime law and environmental care'],
  RELS: ['Religions of the world', 'Teachings and sources', 'Rituals, symbols and sacred places', 'Religious history and institutions', 'Religion, ethics and social issues', 'Researching and comparing religions'],
  SPRT: ['Anatomy and physiology for sport', 'Biomechanics and movement', 'Fitness, conditioning and training', 'Sport nutrition', 'Sport psychology', 'Injury prevention and rehabilitation', 'Sport management, ethics and society'],
  TMATH: ['Numbers, algebra and equations', 'Functions and graphs', 'Finance and growth', 'Trigonometry', 'Analytical and Euclidean geometry', 'Measurement and mensuration', 'Statistics and probability', 'Rate of change and calculus'],
  TSCI: ['Scientific skills and measurement', 'Mechanics', 'Matter and materials', 'Heat and thermodynamics', 'Waves, sound and light', 'Electricity and magnetism', 'Chemical change and industrial applications'],
  VART: ['Visual culture studies', 'Elements and principles of art', 'Drawing and visual investigation', 'Materials, techniques and processes', 'Concept development and practical work', 'South African and African art', 'Presentation, exhibition and professional practice'],
  EGD: ['Design process and presentation', 'Mechanical drawings', 'Civil drawings', 'Descriptive geometry', 'Perspective drawing', 'Solid geometry and intersections', 'Computer-aided drawing'],
};

function subjectFamily(code) {
  const base = code.replace(/-G(?:10|11|12)$/, '');
  if (/-(?:FAL|HL)$/.test(base) || ['ENFAL', 'ENG-FAL'].includes(base)) return 'LANGUAGE';
  return base;
}

async function main() {
  const subjects = await prisma.subject.findMany({
    where: { grade: { in: [10, 11, 12] } },
    include: { topics: { orderBy: { orderIndex: 'asc' }, select: { title: true } } },
    orderBy: [{ grade: 'asc' }, { name: 'asc' }],
  });
  const topicsByBaseCode = new Map();
  for (const subject of subjects) {
    if (!subject.topics.length) continue;
    const baseCode = subject.code.replace(/-G(?:10|11|12)$/, '');
    if (!topicsByBaseCode.has(baseCode)) topicsByBaseCode.set(baseCode, subject.topics.map((item) => item.title));
  }

  const ready = [];
  const unresolved = [];
  for (const subject of subjects) {
    if (subject.topics.length) continue;
    const baseCode = subject.code.replace(/-G(?:10|11|12)$/, '');
    const family = subjectFamily(subject.code);
    const titles = topicsByBaseCode.get(baseCode) ?? (family === 'LANGUAGE' ? LANGUAGE_TOPICS : TOPICS[family]);
    if (!titles?.length) {
      unresolved.push({ grade: subject.grade, code: subject.code, name: subject.name });
      continue;
    }
    ready.push({ subject, titles });
  }

  console.log(`subjects ready for topic seeding: ${ready.length}`);
  console.log(`topics ready: ${ready.reduce((count, item) => count + item.titles.length, 0)}`);
  if (unresolved.length) console.table(unresolved);
  if (!run) {
    console.log('dry run only; set FET_TOPIC_SEED_RUN=1 to apply');
    return;
  }

  for (const { subject, titles } of ready) {
    await prisma.topic.createMany({
      data: titles.map((title, orderIndex) => ({
        subjectId: subject.id,
        title,
        description: `${subject.name} CAPS curriculum strand for Grade ${subject.grade}.`,
        orderIndex,
        importance: 1,
      })),
    });
  }
  console.log(`seeded ${ready.length} subjects with complete navigable topic trees`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
