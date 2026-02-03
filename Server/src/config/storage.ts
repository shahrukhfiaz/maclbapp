import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env';
import { AppError } from '../utils/appError';

let s3Client: S3Client | null = null;

function ensureStorageConfig() {
  const { OBJECT_STORAGE_ACCESS_KEY, OBJECT_STORAGE_SECRET_KEY, OBJECT_STORAGE_ENDPOINT, OBJECT_STORAGE_REGION, OBJECT_STORAGE_BUCKET } = env;
  if (!OBJECT_STORAGE_ACCESS_KEY || !OBJECT_STORAGE_SECRET_KEY || !OBJECT_STORAGE_ENDPOINT || !OBJECT_STORAGE_REGION || !OBJECT_STORAGE_BUCKET) {
    throw new AppError('Object storage is not fully configured', 500);
  }

  return {
    accessKeyId: OBJECT_STORAGE_ACCESS_KEY,
    secretAccessKey: OBJECT_STORAGE_SECRET_KEY,
    endpoint: OBJECT_STORAGE_ENDPOINT,
    region: OBJECT_STORAGE_REGION,
    bucket: OBJECT_STORAGE_BUCKET,
  } as const;
}

export function getObjectStorageClient(): { client: S3Client; bucket: string } {
  const config = ensureStorageConfig();

  if (!s3Client) {
    s3Client = new S3Client({
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
    });
  }

  return { client: s3Client, bucket: config.bucket };
}
