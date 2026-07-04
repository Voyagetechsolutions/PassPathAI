/**
 * Upload the local past-paper PDFs to an S3-compatible bucket (Cloudflare R2).
 *
 * Keys are taken from the database (PastPaper.storageKey and
 * CurriculumDocument.storageKey), so what the app requests is exactly what
 * gets stored — including Windows-style separators if that's what was
 * ingested. Local files are resolved from STORAGE_LOCAL_DIR (./storage).
 *
 * Usage (PowerShell):
 *   $env:AWS_S3_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
 *   $env:AWS_S3_BUCKET="passpath-papers"
 *   $env:AWS_ACCESS_KEY_ID="..."
 *   $env:AWS_SECRET_ACCESS_KEY="..."
 *   $env:AWS_REGION="auto"
 *   npm run db:upload:r2
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();

const endpoint = process.env.AWS_S3_ENDPOINT;
const bucket = process.env.AWS_S3_BUCKET;
if (!endpoint || !bucket || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('Set AWS_S3_ENDPOINT, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY first.');
  process.exit(1);
}

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'auto',
  endpoint,
  forcePathStyle: true,
});

const localDir = process.env.STORAGE_LOCAL_DIR ?? './storage';

async function alreadyUploaded(key: string, size: number): Promise<boolean> {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return head.ContentLength === size;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const papers = await prisma.pastPaper.findMany({ select: { storageKey: true } });
  const docs = await prisma.curriculumDocument.findMany({ select: { storageKey: true } });
  const keys = [...new Set([...papers.map((p) => p.storageKey), ...docs.map((d) => d.storageKey)])].filter(
    (k): k is string => Boolean(k),
  );
  console.log(`${keys.length} unique storage keys in the database`);

  let ok = 0;
  let skipped = 0;
  let missing = 0;
  for (const key of keys) {
    // key may use \ or / — resolve either against the local storage dir
    const rel = key.split(/[\\/]/).join(path.sep);
    const file = path.join(localDir, rel);
    if (!existsSync(file)) {
      console.warn(`MISSING locally: ${key}`);
      missing++;
      continue;
    }
    const size = statSync(file).size;
    if (await alreadyUploaded(key, size)) {
      skipped++;
      continue;
    }
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: createReadStream(file),
        ContentType: 'application/pdf',
        ContentLength: size,
      }),
    );
    ok++;
    if (ok % 25 === 0) {
      console.log(`uploaded ${ok}/${keys.length}…`);
    }
  }
  console.log(`done: ${ok} uploaded, ${skipped} already present, ${missing} missing locally`);
  await prisma.$disconnect();
}

void main();
