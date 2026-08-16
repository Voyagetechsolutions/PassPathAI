import { KnowledgeSourceType, PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractPdf } from '../src/modules/curriculum/ingestion/pdf.util';
import { chunkText } from '../src/modules/curriculum/ingestion/text-chunker';
import { withDbRetry } from '../src/common/utils/db-retry';

const envText = fs.readFileSync('.env', 'utf8');
const urls = [...envText.matchAll(/^DATABASE_URL=(.+)$/gm)]
  .map((match) => match[1].trim().replace(/^['"]|['"]$/g, ''));
process.env.DATABASE_URL = urls.at(-1);

const prisma = new PrismaClient();
const storageDir = process.env.STORAGE_LOCAL_DIR ?? './storage';
const run = process.env.FET_CORPUS_INGEST_RUN === '1';

const references = [
  { baseCode: 'AFR-HL', name: 'Afrikaans Home Language', file: 'AFR-HL-G10.pdf' },
  { baseCode: 'ENG-HL', name: 'English Home Language', file: 'ENG-HL-G10.pdf' },
  { baseCode: 'NSO-HL', name: 'Sepedi Home Language', file: 'NSO-HL-G10.pdf' },
  { baseCode: 'VEN-HL', name: 'Tshivenda Home Language', file: 'VEN-HL-G10.pdf' },
  { baseCode: 'EGD', name: 'Engineering Graphics and Design', file: 'EGD-G10.pdf' },
];

async function main(): Promise<void> {
  const ready = references.map((reference) => ({
    ...reference,
    fullPath: path.join(storageDir, 'curriculum', reference.file),
  }));
  for (const reference of ready) {
    if (!fs.existsSync(reference.fullPath)) throw new Error(`Missing ${reference.fullPath}`);
  }
  console.log(`${ready.length} official CAPS FET references ready for Grades 10-12`);
  if (!run) {
    console.log('dry run only; set FET_CORPUS_INGEST_RUN=1 to apply');
    return;
  }

  let totalChunks = 0;
  for (const reference of ready) {
    const bytes = fs.readFileSync(reference.fullPath);
    const { text, pageCount } = await extractPdf(bytes);
    const chunks = chunkText(text);
    if (!chunks.length) throw new Error(`No extractable text in ${reference.file}`);

    for (const grade of [10, 11, 12]) {
      const subjectCode = `${reference.baseCode}-G${grade}`;
      const documentId = `doc-${subjectCode}`;
      const document = await withDbRetry(() => prisma.curriculumDocument.upsert({
        where: { id: documentId },
        update: {
          title: `${reference.name} CAPS Grades 10-12`,
          subjectCode,
          grade,
          storageKey: `curriculum/${reference.file}`,
          mimeType: 'application/pdf',
          ingested: true,
          pageCount,
        },
        create: {
          id: documentId,
          title: `${reference.name} CAPS Grades 10-12`,
          subjectCode,
          grade,
          storageKey: `curriculum/${reference.file}`,
          mimeType: 'application/pdf',
          ingested: true,
          pageCount,
        },
      }));
      await withDbRetry(() => prisma.knowledgeChunk.deleteMany({ where: { documentId: document.id } }));
      for (let offset = 0; offset < chunks.length; offset += 200) {
        await withDbRetry(() => prisma.knowledgeChunk.createMany({
          data: chunks.slice(offset, offset + 200).map((chunk) => ({
            documentId: document.id,
            sourceType: KnowledgeSourceType.CURRICULUM,
            subjectCode,
            grade,
            content: chunk.content.replace(/\0/g, ''),
            tokenCount: chunk.tokenCount,
          })),
        }));
      }
      totalChunks += chunks.length;
      console.log(`${subjectCode.padEnd(12)} ${pageCount} pages -> ${chunks.length} chunks`);
    }
  }
  console.log(`ingested ${totalChunks} official curriculum chunks`);
}

void main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
