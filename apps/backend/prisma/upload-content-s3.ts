/**
 * Synchronise locally-ingested curriculum documents and past papers to AWS S3
 * (or another S3-compatible service).
 *
 * Keys come from PastPaper.storageKey and CurriculumDocument.storageKey, so
 * the objects uploaded here exactly match what the API retrieves.
 *
 * Native AWS usage (PowerShell):
 *   $env:AWS_S3_BUCKET="the-bucket-created-by-CloudFormation"
 *   $env:AWS_REGION="af-south-1"
 *   npm run db:upload:s3
 *
 * Credentials use the normal AWS SDK chain. On Railway, set access-key
 * environment variables. On AWS compute, attach an IAM role and omit keys.
 *
 * Optional:
 *   S3_UPLOAD_DRY_RUN=1
 *   S3_UPLOAD_ALL=1          Also upload every file under STORAGE_LOCAL_DIR
 *   S3_UPLOAD_CONCURRENCY=4
 */
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const prisma = new PrismaClient();
const endpoint = process.env.AWS_S3_ENDPOINT;
const bucket = process.env.AWS_S3_BUCKET;

if (!bucket) {
  console.error('Set AWS_S3_BUCKET first.');
  process.exit(1);
}

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? (endpoint ? 'auto' : 'af-south-1'),
  endpoint: endpoint || undefined,
  forcePathStyle: Boolean(endpoint),
});

const localDir = process.env.STORAGE_LOCAL_DIR ?? './storage';
const dryRun = process.env.S3_UPLOAD_DRY_RUN === '1';
const uploadAll = process.env.S3_UPLOAD_ALL === '1';
const concurrency = Math.max(1, Number.parseInt(process.env.S3_UPLOAD_CONCURRENCY ?? '4', 10) || 4);

interface LocalObject {
  key: string;
  file: string;
  size: number;
}

function buildBasenameIndex(dir: string): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile()) {
        const name = entry.name.toLowerCase();
        index.set(name, [...(index.get(name) ?? []), fullPath]);
      }
    }
  };
  if (existsSync(dir)) {
    visit(dir);
  }
  return index;
}

function listLocalFiles(dir: string): string[] {
  const files: string[] = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  };
  if (existsSync(dir)) {
    visit(dir);
  }
  return files;
}

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
  const keys = [
    ...new Set([...papers.map((paper) => paper.storageKey), ...docs.map((doc) => doc.storageKey)]),
  ].filter((key): key is string => Boolean(key));

  console.log(`${keys.length} unique storage keys in the database`);

  const localObjectsByKey = new Map<string, LocalObject>();
  const basenameIndex = buildBasenameIndex(localDir);
  let missing = 0;
  for (const originalKey of keys) {
    // S3 keys always use "/", including keys created by older Windows imports.
    const key = originalKey.split(/[\\/]/).join('/');
    const parts = key.split('/');
    if (parts.some((part) => part === '..') || path.isAbsolute(originalKey)) {
      console.warn(`UNSAFE storage key: ${originalKey}`);
      missing += 1;
      continue;
    }
    let file = path.join(localDir, ...parts);
    if (!existsSync(file)) {
      const matches = basenameIndex.get(path.basename(key).toLowerCase()) ?? [];
      if (matches.length !== 1) {
        console.warn(
          `${matches.length > 1 ? 'AMBIGUOUS' : 'MISSING'} locally: ${originalKey}`,
        );
        missing += 1;
        continue;
      }
      file = matches[0];
      console.log(`resolved ${originalKey} from ${path.relative(localDir, file)}`);
    }
    localObjectsByKey.set(key, { key, file, size: statSync(file).size });
  }

  if (uploadAll) {
    for (const file of listLocalFiles(localDir)) {
      const key = path.relative(localDir, file).split(path.sep).join('/');
      if (!localObjectsByKey.has(key)) {
        localObjectsByKey.set(key, { key, file, size: statSync(file).size });
      }
    }
  }

  const localObjects = [...localObjectsByKey.values()];
  const bytes = localObjects.reduce((total, object) => total + object.size, 0);
  if (dryRun) {
    console.log(
      `dry run: ${localObjects.length} S3 objects (${(bytes / 1024 / 1024).toFixed(1)} MiB) ready, ${missing} missing`,
    );
    return;
  }

  let uploaded = 0;
  let skipped = 0;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < localObjects.length) {
      const object = localObjects[cursor++];
      if (await alreadyUploaded(object.key, object.size)) {
        skipped += 1;
        continue;
      }
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: object.key,
          Body: createReadStream(object.file),
          ContentType:
            path.extname(object.file).toLowerCase() === '.pdf'
              ? 'application/pdf'
              : 'application/octet-stream',
          ContentLength: object.size,
          // Native S3 also encrypts new objects by default. Making this explicit
          // documents the requirement and preserves compatible-endpoint support.
          ServerSideEncryption: endpoint ? undefined : 'AES256',
        }),
      );
      uploaded += 1;
      if (uploaded % 25 === 0) {
        console.log(`uploaded ${uploaded}/${localObjects.length}`);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, localObjects.length) }, () => worker()),
  );
  console.log(
    `done: ${uploaded} uploaded, ${skipped} already present, ${missing} missing locally`,
  );
  if (missing > 0) {
    process.exitCode = 2;
  }
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
