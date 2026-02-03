import { randomUUID } from 'crypto';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Prisma, LogLevel } from '@prisma/client';
import { prisma } from '../db/client';
import { getObjectStorageClient } from '../config/storage';
import { AppError } from '../utils/appError';

const DEFAULT_URL_EXPIRY_SECONDS = 900; // 15 minutes

async function appendSessionLog(
  sessionId: string,
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
) {
  await prisma.datSessionLog.create({
    data: {
      sessionId,
      level,
      message,
      context: (context ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

function ensureBundleKey(key?: string | null): asserts key is string {
  if (!key) {
    throw new AppError('Session bundle is not available for download. Please set up the session first.', 409);
  }
}

export async function createSessionBundleDownloadUrl(
  sessionId: string,
  expiresInSeconds = DEFAULT_URL_EXPIRY_SECONDS
) {
  const session = await prisma.datSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new AppError('Session not found', 404);
  }

  ensureBundleKey(session.bundleKey);

  const { client, bucket } = getObjectStorageClient();
  const command = new GetObjectCommand({ Bucket: bucket, Key: session.bundleKey });
  const signedUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });

  await appendSessionLog(sessionId, 'INFO', 'Generated bundle download URL', {
    expiresInSeconds,
    bundleKey: session.bundleKey,
  });

  return {
    url: signedUrl,
    expiresInSeconds,
    bundleKey: session.bundleKey,
  };
}

interface UploadRequestOptions {
  contentType?: string;
  expiresInSeconds?: number;
}

export async function createSessionBundleUploadUrl(
  sessionId: string,
  options: UploadRequestOptions = {}
) {
  const session = await prisma.datSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new AppError('Session not found', 404);
  }

  const expiresInSeconds = options.expiresInSeconds ?? DEFAULT_URL_EXPIRY_SECONDS;
  const newKey = `sessions/${session.id}/${Date.now()}-${randomUUID()}.zip`;

  const { client, bucket } = getObjectStorageClient();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: newKey,
    ContentType: options.contentType ?? 'application/zip',
  });
  const signedUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });

  await prisma.datSession.update({
    where: { id: sessionId },
    data: {
      status: 'UPLOADING',
      bundleKey: newKey,
      updatedAt: new Date(),
    },
  });

  await appendSessionLog(sessionId, 'INFO', 'Generated bundle upload URL', {
    expiresInSeconds,
    bundleKey: newKey,
  });

  return {
    url: signedUrl,
    expiresInSeconds,
    bundleKey: newKey,
  };
}

interface CompleteUploadInput {
  sessionId: string;
  checksum?: string;
  fileSizeBytes?: number;
  encryption?: string;
}

export async function completeBundleUpload({
  sessionId,
  checksum,
  fileSizeBytes,
  encryption,
}: CompleteUploadInput) {
  const session = await prisma.datSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new AppError('Session not found', 404);
  }

  ensureBundleKey(session.bundleKey);

  const bundleVersion = session.bundleVersion + 1;

  await prisma.datSession.update({
    where: { id: sessionId },
    data: {
      status: 'READY',
      bundleChecksum: checksum ?? session.bundleChecksum,
      bundleEncryption: encryption ?? session.bundleEncryption,
      bundleVersion,
      lastSyncedAt: new Date(),
    },
  });

  await appendSessionLog(sessionId, 'INFO', 'Session bundle upload completed', {
    checksum,
    fileSizeBytes,
    bundleVersion,
    encryption,
  });
}

export { appendSessionLog as recordSessionEvent };


