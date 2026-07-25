import 'dotenv/config';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { KnowledgeSourceType, PrismaClient } from '@prisma/client';
import {
  GetDocumentTextDetectionCommand,
  StartDocumentTextDetectionCommand,
  TextractClient,
} from '@aws-sdk/client-textract';
import { chunkText } from '../src/modules/curriculum/ingestion/text-chunker';
import { withDbRetry } from '../src/common/utils/db-retry';

const prisma = new PrismaClient();
const region = process.env.AWS_REGION ?? 'eu-west-2';
const bucket = process.env.AWS_S3_BUCKET;
const storageDir = process.env.STORAGE_LOCAL_DIR ?? './storage';
const syllabusDir = path.join(storageDir, 'grade 12 syllabus');
const run = process.env.TEXTRACT_RUN === '1';
const textract = new TextractClient({ region });

if (!bucket) {
  throw new Error('AWS_S3_BUCKET is required');
}

const subjects: Array<[RegExp, string, string]> = [
  [/economics/i, 'ECON-G12', 'Economics'],
  [/english[-_ ]fal/i, 'ENFAL-G12', 'English First Additional Language'],
  [/english[-_ ]hl/i, 'ENG-HL-G12', 'English Home Language'],
  [/history/i, 'HIST-G12', 'History'],
  [/life[-_ ]sciences/i, 'LIFE-G12', 'Life Sciences'],
  [/physical[-_ ]sciences/i, 'PHSC-G12', 'Physical Sciences'],
  [/(national[-_ ])?maths/i, 'MATH-G12', 'Mathematics'],
];

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function extractWithTextract(key: string): Promise<{ text: string; pageCount: number }> {
  const token = createHash('sha256').update(`${bucket}/${key}`).digest('hex').slice(0, 64);
  const start = await textract.send(
    new StartDocumentTextDetectionCommand({
      DocumentLocation: { S3Object: { Bucket: bucket, Name: key } },
      ClientRequestToken: token,
      JobTag: `passpath-${slug(path.basename(key)).slice(0, 50)}`,
    }),
  );
  if (!start.JobId) throw new Error(`Textract returned no job id for ${key}`);

  let status: string | undefined;
  do {
    await wait(3000);
    const result = await textract.send(
      new GetDocumentTextDetectionCommand({ JobId: start.JobId, MaxResults: 1000 }),
    );
    status = result.JobStatus;
    if (status === 'FAILED' || status === 'PARTIAL_SUCCESS') {
      throw new Error(`Textract ${status} for ${key}: ${result.StatusMessage ?? 'no message'}`);
    }
  } while (status !== 'SUCCEEDED');

  const lines: Array<{ page: number; top: number; left: number; text: string }> = [];
  let nextToken: string | undefined;
  let pageCount = 0;
  do {
    const result = await textract.send(
      new GetDocumentTextDetectionCommand({
        JobId: start.JobId,
        MaxResults: 1000,
        NextToken: nextToken,
      }),
    );
    for (const block of result.Blocks ?? []) {
      pageCount = Math.max(pageCount, block.Page ?? 0);
      if (block.BlockType === 'LINE' && block.Text) {
        lines.push({
          page: block.Page ?? 0,
          top: block.Geometry?.BoundingBox?.Top ?? 0,
          left: block.Geometry?.BoundingBox?.Left ?? 0,
          text: block.Text,
        });
      }
    }
    nextToken = result.NextToken;
  } while (nextToken);

  lines.sort((a, b) => a.page - b.page || a.top - b.top || a.left - b.left);
  let currentPage = 0;
  const textParts: string[] = [];
  for (const line of lines) {
    if (line.page !== currentPage) {
      currentPage = line.page;
      textParts.push(`\n\n[Page ${currentPage}]\n`);
    }
    textParts.push(line.text, '\n');
  }
  return { text: textParts.join('').trim(), pageCount };
}

async function main(): Promise<void> {
  if (!existsSync(syllabusDir)) throw new Error(`Missing folder: ${syllabusDir}`);
  const files = readdirSync(syllabusDir).filter((filename) => {
    if (!filename.toLowerCase().endsWith('.pdf')) return false;
    return subjects.some(([pattern]) => pattern.test(filename));
  });

  let ingested = 0;
  let skipped = 0;
  for (const filename of files) {
    const subject = subjects.find(([pattern]) => pattern.test(filename));
    if (!subject) continue;
    const [, subjectCode, subjectName] = subject;
    const id = `syl-local-${slug(filename)}`;
    const existing = await prisma.curriculumDocument.findUnique({ where: { id } });
    if (existing?.ingested) {
      skipped += 1;
      continue;
    }
    const key = `grade 12 syllabus/${filename}`;
    if (!run) {
      console.log(`${subjectCode.padEnd(12)} ${key}`);
      continue;
    }

    console.log(`OCR ${filename}`);
    const { text, pageCount } = await extractWithTextract(key);
    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error(`Textract returned no usable text for ${filename}`);
    const title = `${subjectName} - ${filename.replace(/\.pdf$/i, '')}`;
    const document = await withDbRetry(() =>
      prisma.curriculumDocument.upsert({
        where: { id },
        update: { title, subjectCode, grade: 12, storageKey: key, ingested: true, pageCount },
        create: {
          id,
          title,
          subjectCode,
          grade: 12,
          storageKey: key,
          mimeType: 'application/pdf',
          ingested: true,
          pageCount,
        },
      }),
    );
    await withDbRetry(() => prisma.knowledgeChunk.deleteMany({ where: { documentId: document.id } }));
    for (let index = 0; index < chunks.length; index += 200) {
      await withDbRetry(() =>
        prisma.knowledgeChunk.createMany({
          data: chunks.slice(index, index + 200).map((chunk) => ({
            documentId: document.id,
            sourceType: KnowledgeSourceType.CURRICULUM,
            subjectCode,
            grade: 12,
            content: chunk.content,
            tokenCount: chunk.tokenCount,
          })),
        }),
      );
    }
    console.log(`  ${pageCount} pages -> ${chunks.length} chunks`);
    ingested += 1;
  }
  console.log(
    run
      ? `Textract ingestion complete: ${ingested} ingested, ${skipped} already present`
      : `dry run: ${files.length - skipped} scanned PDFs need Textract; ${skipped} already present`,
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
