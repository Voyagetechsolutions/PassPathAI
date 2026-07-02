import { KnowledgeSourceType, PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { extractPdf } from '../src/modules/curriculum/ingestion/pdf.util';
import { chunkText } from '../src/modules/curriculum/ingestion/text-chunker';
import { withDbRetry } from '../src/common/utils/db-retry';

const prisma = new PrismaClient();
const STORAGE_DIR = process.env.STORAGE_LOCAL_DIR ?? './storage';
const BASE = process.env.CAPS_DIR ?? 'C:/Users/Mthokozisi.DESKTOP-DPOBCC1/Downloads';

const FOLDERS = [
  { dir: path.join(BASE, 'grade 7 to 9'), grade: 9 },
  { dir: path.join(BASE, 'grade 10 to 12'), grade: 10 },
];

// Each entry: ALL `keys` must appear (lowercased) in the filename. Order matters —
// specific phrases first, then generic; FAL languages before Home Languages.
const MAP: Array<{ keys: string[]; code: string; name: string }> = [
  // First Additional Languages
  { keys: ['fal', 'english'], code: 'ENG-FAL', name: 'English First Additional Language' },
  { keys: ['fal', 'afrikaans'], code: 'AFR-FAL', name: 'Afrikaans First Additional Language' },
  { keys: ['fal', 'isizulu'], code: 'ZUL-FAL', name: 'isiZulu First Additional Language' },
  { keys: ['fal', 'isixhosa'], code: 'XHO-FAL', name: 'isiXhosa First Additional Language' },
  { keys: ['fal', 'isindebele'], code: 'NBL-FAL', name: 'isiNdebele First Additional Language' },
  { keys: ['fal', 'sepedi'], code: 'NSO-FAL', name: 'Sepedi First Additional Language' },
  { keys: ['fal', 'sesotho'], code: 'SOT-FAL', name: 'Sesotho First Additional Language' },
  { keys: ['fal', 'setswana'], code: 'TSW-FAL', name: 'Setswana First Additional Language' },
  { keys: ['fal', 'siswati'], code: 'SSW-FAL', name: 'Siswati First Additional Language' },
  { keys: ['fal', 'venda'], code: 'VEN-FAL', name: 'Tshivenda First Additional Language' },
  { keys: ['fal', 'tsonga'], code: 'TSO-FAL', name: 'Xitsonga First Additional Language' },
  // Content subjects — specific before generic
  { keys: ['mathematical literacy'], code: 'MLIT', name: 'Mathematical Literacy' },
  { keys: ['agricultural technology'], code: 'AGRT', name: 'Agricultural Technology' },
  { keys: ['agri management'], code: 'AGRM', name: 'Agricultural Management Practices' },
  { keys: ['agricultural science'], code: 'AGRI', name: 'Agricultural Sciences' },
  { keys: ['computer applications'], code: 'CAT', name: 'Computer Applications Technology' },
  { keys: ['information technology'], code: 'IT', name: 'Information Technology' },
  { keys: ['civil tech'], code: 'CIVT', name: 'Civil Technology' },
  { keys: ['electrical tech'], code: 'ELET', name: 'Electrical Technology' },
  { keys: ['mech tech'], code: 'MECT', name: 'Mechanical Technology' },
  { keys: ['maths tech'], code: 'TMATH', name: 'Technical Mathematics' },
  { keys: ['science tech'], code: 'TSCI', name: 'Technical Sciences' },
  { keys: ['physical science'], code: 'PHSC', name: 'Physical Sciences' },
  { keys: ['natural science'], code: 'NATSCI', name: 'Natural Sciences' },
  { keys: ['marine science'], code: 'MARI', name: 'Marine Sciences' },
  { keys: ['maritime'], code: 'MARE', name: 'Maritime Economics' },
  { keys: ['nautical'], code: 'NAUT', name: 'Nautical Science' },
  { keys: ['life science'], code: 'LIFE', name: 'Life Sciences' },
  { keys: ['life orientation'], code: 'LFOR', name: 'Life Orientation' },
  { keys: ['social science'], code: 'SOCSCI', name: 'Social Sciences' },
  { keys: ['accounting'], code: 'ACCN', name: 'Accounting' },
  { keys: ['business studies'], code: 'BSTD', name: 'Business Studies' },
  { keys: ['economic and management'], code: 'EMS', name: 'Economic and Management Sciences' },
  { keys: ['ems'], code: 'EMS', name: 'Economic and Management Sciences' },
  { keys: ['economics'], code: 'ECON', name: 'Economics' },
  { keys: ['geography'], code: 'GEOG', name: 'Geography' },
  { keys: ['tourism'], code: 'TOUR', name: 'Tourism' },
  { keys: ['consumer studies'], code: 'CONS', name: 'Consumer Studies' },
  { keys: ['hospitality'], code: 'HOSP', name: 'Hospitality Studies' },
  { keys: ['dance'], code: 'DANC', name: 'Dance Studies' },
  { keys: ['design'], code: 'DSGN', name: 'Design Studies' },
  { keys: ['dramatic arts'], code: 'DRAM', name: 'Dramatic Arts' },
  { keys: ['visual arts'], code: 'VART', name: 'Visual Arts' },
  { keys: ['creative arts'], code: 'CART', name: 'Creative Arts' },
  { keys: ['music'], code: 'MUSC', name: 'Music' },
  { keys: ['religion'], code: 'RELS', name: 'Religion Studies' },
  { keys: ['sport and exercise'], code: 'SPRT', name: 'Sport and Exercise Science' },
  { keys: ['equine'], code: 'EQUI', name: 'Equine Studies' },
  { keys: ['coding'], code: 'CODE', name: 'Coding and Robotics' },
  { keys: ['robotics'], code: 'CODE', name: 'Coding and Robotics' },
  { keys: ['technology'], code: 'TECH', name: 'Technology' },
  { keys: ['mathematics'], code: 'MATH', name: 'Mathematics' },
  // Home Languages (after content + FAL)
  { keys: ['english'], code: 'ENG-HL', name: 'English Home Language' },
  { keys: ['afrikaans'], code: 'AFR-HL', name: 'Afrikaans Home Language' },
  { keys: ['isizulu'], code: 'ZUL-HL', name: 'isiZulu Home Language' },
  { keys: ['isixhosa'], code: 'XHO-HL', name: 'isiXhosa Home Language' },
  { keys: ['isindebele'], code: 'NBL-HL', name: 'isiNdebele Home Language' },
  { keys: ['sepedi'], code: 'NSO-HL', name: 'Sepedi Home Language' },
  { keys: ['sesotho'], code: 'SOT-HL', name: 'Sesotho Home Language' },
  { keys: ['setswana'], code: 'TSW-HL', name: 'Setswana Home Language' },
  { keys: ['siswati'], code: 'SSW-HL', name: 'Siswati Home Language' },
  { keys: ['tshivenda'], code: 'VEN-HL', name: 'Tshivenda Home Language' },
  { keys: ['xitsonga'], code: 'TSO-HL', name: 'Xitsonga Home Language' },
  { keys: ['serbian'], code: 'SRP-HL', name: 'Serbian Home Language' },
];

function match(filename: string): { code: string; name: string } | null {
  const lower = filename.toLowerCase();
  for (const m of MAP) {
    if (m.keys.every((k) => lower.includes(k))) {
      return { code: m.code, name: m.name };
    }
  }
  return null;
}

async function main(): Promise<void> {
  const seen = new Set<string>();
  let totalChunks = 0;
  let done = 0;

  for (const folder of FOLDERS) {
    if (!fs.existsSync(folder.dir)) {
      // eslint-disable-next-line no-console
      console.log(`MISSING FOLDER: ${folder.dir}`);
      continue;
    }
    const files = fs.readdirSync(folder.dir).filter((f) => f.toLowerCase().endsWith('.pdf'));
    for (const file of files) {
      const m = match(file);
      if (!m) {
        // eslint-disable-next-line no-console
        console.log(`UNMATCHED: ${file}`);
        continue;
      }
      const code = `${m.code}-G${folder.grade}`;
      if (seen.has(code)) {
        continue;
      }
      seen.add(code);

      try {
        const bytes = fs.readFileSync(path.join(folder.dir, file));
        const { text, pageCount } = await extractPdf(bytes);
        const chunks = chunkText(text);
        if (chunks.length === 0) {
          // eslint-disable-next-line no-console
          console.log(`SKIP (no text): ${file}`);
          continue;
        }

        const key = `curriculum/${code}.pdf`;
        fs.mkdirSync(path.join(STORAGE_DIR, 'curriculum'), { recursive: true });
        fs.writeFileSync(path.join(STORAGE_DIR, key), bytes);

        const doc = await withDbRetry(() =>
          prisma.curriculumDocument.upsert({
            where: { id: code },
            update: { title: m.name, subjectCode: code, grade: folder.grade, ingested: true, pageCount },
            create: {
              id: code,
              title: m.name,
              subjectCode: code,
              grade: folder.grade,
              storageKey: key,
              mimeType: 'application/pdf',
              ingested: true,
              pageCount,
            },
          }),
        );

        await withDbRetry(() => prisma.knowledgeChunk.deleteMany({ where: { documentId: doc.id } }));
        for (let i = 0; i < chunks.length; i += 200) {
          const slice = chunks.slice(i, i + 200);
          await withDbRetry(() =>
            prisma.knowledgeChunk.createMany({
              data: slice.map((c) => ({
                documentId: doc.id,
                sourceType: KnowledgeSourceType.CURRICULUM,
                subjectCode: code,
                grade: folder.grade,
                content: c.content,
                tokenCount: c.tokenCount,
              })),
            }),
          );
        }
        totalChunks += chunks.length;
        done += 1;
        // eslint-disable-next-line no-console
        console.log(`${code.padEnd(12)} ${String(pageCount).padStart(3)}p -> ${String(chunks.length).padStart(4)} chunks   ${m.name}`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log(`ERROR ${code}: ${(e as Error).message}`);
      }
    }
  }
  // eslint-disable-next-line no-console
  console.log(`\nIngested ${done} documents, ${totalChunks} chunks across both phases. Run the embeddings backfill next.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
