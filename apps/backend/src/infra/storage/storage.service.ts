import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { AppConfig } from '../../config/configuration';

export interface StoredObject {
  key: string;
  url: string;
}

/**
 * Storage abstraction. Two interchangeable drivers:
 *  - s3:    AWS S3 (or any S3-compatible endpoint such as MinIO)
 *  - local: filesystem under STORAGE_LOCAL_DIR (dev / tests)
 *
 * Consumers depend only on this interface, never on the SDK directly.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: 's3' | 'local';
  private readonly bucket: string;
  private readonly localDir: string;
  private readonly s3?: S3Client;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const storage = this.config.get('storage', { infer: true });
    this.driver = storage.driver;
    this.bucket = storage.bucket;
    this.localDir = storage.localDir;

    if (this.driver === 's3') {
      this.s3 = new S3Client({
        region: storage.region,
        endpoint: storage.endpoint,
        forcePathStyle: Boolean(storage.endpoint),
        credentials:
          storage.accessKeyId && storage.secretAccessKey
            ? { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey }
            : undefined,
      });
    }
  }

  /**
   * Persist bytes under `key` and return a retrievable reference.
   */
  async put(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    if (this.driver === 's3' && this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      return { key, url: await this.signedUrl(key) };
    }

    const fullPath = path.join(this.localDir, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, body);
    return { key, url: `file://${fullPath}` };
  }

  /**
   * Read bytes back for processing (e.g. ingestion).
   */
  async get(key: string): Promise<Buffer> {
    if (this.driver === 's3' && this.s3) {
      const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) {
        throw new Error(`Empty object: ${key}`);
      }
      return Buffer.from(bytes);
    }
    return fs.readFile(path.join(this.localDir, key));
  }

  /**
   * Time-limited download URL (S3 only; local returns a file:// path).
   */
  async signedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    if (this.driver === 's3' && this.s3) {
      return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
        expiresIn: expiresInSeconds,
      });
    }
    return `file://${path.join(this.localDir, key)}`;
  }
}
