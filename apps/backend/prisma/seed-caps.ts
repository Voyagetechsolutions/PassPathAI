import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds the CAPS Grade-10 (FET) curriculum structure — subjects and their real
 * syllabus topics — across the core subjects. Mathematics is owned by
 * seed-subject.ts (it also has questions/AI content) and is left untouched.
 * Idempotent: upserts each subject by code and replaces its topic list.
 */
const SUBJECTS: Array<{ name: string; code: string; topics: string[] }> = [
  {
    name: 'Physical Sciences',
    code: 'PHSC-G10',
    topics: [
      'Skills for science',
      'Matter and classification of materials',
      'States of matter and the kinetic molecular theory',
      'Atomic structure',
      'The periodic table',
      'Chemical bonding',
      'Physical and chemical change',
      'Representing chemical change (stoichiometry)',
      'Vectors and scalars',
      'Motion in one dimension',
      'Energy',
      'Transverse pulses and waves',
      'Sound',
      'Electromagnetic radiation',
      'Electrostatics',
      'Electric circuits',
      'Magnetism',
    ],
  },
  {
    name: 'Life Sciences',
    code: 'LIFE-G10',
    topics: [
      'The chemistry of life',
      'Cells: the basic units of life',
      'Cell division (mitosis)',
      'Plant and animal tissues',
      'Support and transport systems in plants',
      'Support and transport systems in animals',
      'Biodiversity and classification of micro-organisms',
      'Biodiversity of plants',
      'Reproduction in plants',
      'Biodiversity of animals',
      'History of life on Earth',
      'The biosphere to ecosystems',
    ],
  },
  {
    name: 'Accounting',
    code: 'ACCN-G10',
    topics: [
      'Accounting concepts and GAAP',
      'Bookkeeping of a sole trader',
      'The accounting equation',
      'Source documents and journals',
      'General ledger and trial balance',
      'Financial statements of a sole trader',
      'Salaries and wages',
      'Value-Added Tax (VAT)',
      'Cost accounting concepts',
      'Budgeting',
      'Ethics and internal control',
    ],
  },
  {
    name: 'Business Studies',
    code: 'BSTD-G10',
    topics: [
      'Business environments',
      'Micro, market and macro environments',
      'Forms of ownership',
      'Sectors of the economy',
      'Entrepreneurship',
      'Contemporary socio-economic issues',
      'Business operations',
      'Business roles',
      'Creative thinking and problem solving',
      'Self-management and study skills',
    ],
  },
  {
    name: 'Economics',
    code: 'ECON-G10',
    topics: [
      'The economic problem and basic concepts',
      'The circular flow',
      'Economic systems',
      'Production possibility curves',
      'Markets and price determination',
      'The public sector',
      'Money and banking',
      'Population and the labour force',
      'Economic growth and development',
      'Economic and social indicators',
    ],
  },
  {
    name: 'Geography',
    code: 'GEOG-G10',
    topics: [
      'Map skills and geographical techniques',
      'Geographic Information Systems (GIS)',
      'The atmosphere: weather and climate',
      'Mid-latitude and tropical cyclones',
      'Geomorphology: structure and landforms',
      'Drainage systems and river profiles',
      'Population: structure, growth and movement',
      'Water resources and management',
      'Settlement geography',
    ],
  },
  {
    name: 'History',
    code: 'HIST-G10',
    topics: [
      'The world around 1600',
      'European expansion and conquest (15th–18th centuries)',
      'The French Revolution',
      'Transformations in southern Africa after 1750',
      'Colonial expansion after 1750',
      'The South African War and Union',
      'Working with historical sources',
    ],
  },
  {
    name: 'Mathematical Literacy',
    code: 'MLIT-G10',
    topics: [
      'Numbers and calculations with numbers',
      'Patterns, relationships and representations',
      'Finance: financial documents and tariffs',
      'Finance: interest, banking and inflation',
      'Measurement: conversions and time',
      'Measurement: perimeter, area and volume',
      'Maps, plans and other representations',
      'Data handling',
      'Probability',
    ],
  },
  {
    name: 'Life Orientation',
    code: 'LFOR-G10',
    topics: [
      'Development of the self in society',
      'Social and environmental responsibility',
      'Democracy and human rights',
      'Careers and career choices',
      'Study skills',
      'Physical education and movement',
    ],
  },
  {
    name: 'Computer Applications Technology',
    code: 'CAT-G10',
    topics: [
      'Systems technologies: hardware',
      'Systems technologies: software',
      'Word processing',
      'Spreadsheets',
      'Databases',
      'Internet and the World Wide Web',
      'Networks and communications',
      'Information management',
      'Social implications of technology',
      'Solution development',
    ],
  },
  {
    name: 'Information Technology',
    code: 'IT-G10',
    topics: [
      'Systems technologies',
      'Hardware and software',
      'Communication and network technologies',
      'Internet technologies',
      'Data and information management (databases)',
      'Algorithms and programming concepts',
      'Solution development',
      'Social and ethical implications',
    ],
  },
  {
    name: 'Tourism',
    code: 'TOUR-G10',
    topics: [
      'Tourism sectors',
      'Map work, time zones and tour planning',
      'Tourism attractions',
      'Sustainable and responsible tourism',
      'Domestic, regional and international tourism',
      'Culture and heritage tourism',
      'Foreign exchange',
      'Marketing',
      'Communication and customer care',
    ],
  },
  {
    name: 'Agricultural Sciences',
    code: 'AGRI-G10',
    topics: [
      'Animal nutrition',
      'Animal production, protection and control',
      'Plant studies: soil science',
      'Plant production',
      'Agricultural ecology',
      'Basic agricultural chemistry',
      'Basic genetics',
    ],
  },
  {
    name: 'English First Additional Language',
    code: 'ENFAL-G10',
    topics: [
      'Listening and speaking',
      'Reading and viewing: comprehension',
      'Literature: novel',
      'Literature: drama',
      'Literature: poetry',
      'Literature: short stories',
      'Writing: essays',
      'Writing: transactional texts',
      'Language structures and conventions',
    ],
  },
];

async function main(): Promise<void> {
  let topicCount = 0;
  for (const s of SUBJECTS) {
    const subject = await prisma.subject.upsert({
      where: { code: s.code },
      update: { name: s.name, grade: 10 },
      create: { name: s.name, code: s.code, grade: 10, weighting: 1 },
    });
    await prisma.topic.deleteMany({ where: { subjectId: subject.id } });
    await prisma.topic.createMany({
      data: s.topics.map((title, i) => ({
        subjectId: subject.id,
        title,
        orderIndex: i,
        importance: 1,
      })),
    });
    topicCount += s.topics.length;
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${SUBJECTS.length} CAPS Grade-10 subjects with ${topicCount} topics.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
