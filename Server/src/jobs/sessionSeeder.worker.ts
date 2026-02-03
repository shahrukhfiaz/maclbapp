import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { chromium } from 'playwright';
import { env } from '../config/env';

interface SeederConfig {
  sessionId: string;
  apiBaseUrl: string;
  apiToken: string;
  datUsername: string;
  datPassword: string;
  encryptionKey?: string;
}

function resolveConfig(): SeederConfig {
  const sessionId = process.argv[2];
  if (!sessionId) {
    throw new Error('Session id argument is required (usage: ts-node jobs/sessionSeeder.worker.ts <sessionId>)');
  }

  const { API_BASE_URL, SEEDER_API_TOKEN, DAT_MASTER_USERNAME, DAT_MASTER_PASSWORD, SESSION_BUNDLE_ENCRYPTION_KEY } = env;

  if (!API_BASE_URL || !SEEDER_API_TOKEN || !DAT_MASTER_USERNAME || !DAT_MASTER_PASSWORD) {
    throw new Error('Seeder environment variables are not fully configured');
  }

  return {
    sessionId,
    apiBaseUrl: API_BASE_URL,
    apiToken: SEEDER_API_TOKEN,
    datUsername: DAT_MASTER_USERNAME,
    datPassword: DAT_MASTER_PASSWORD,
    encryptionKey: SESSION_BUNDLE_ENCRYPTION_KEY,
  };
}

async function sendSessionEvent(config: SeederConfig, level: 'INFO' | 'WARN' | 'ERROR', message: string, context?: Record<string, unknown>) {
  try {
    await axios.post(
      `${config.apiBaseUrl}/sessions/${config.sessionId}/events`,
      { level, message, context },
      { headers: { Authorization: `Bearer ${config.apiToken}` } }
    );
  } catch (error) {
    console.error('Failed to send session event', error);
  }
}

async function loginToDat(sessionContextDir: string, config: SeederConfig) {
  const context = await chromium.launchPersistentContext(sessionContextDir, {
    headless: true,
    viewport: { width: 1280, height: 720 },
  });

  try {
    const page = await context.newPage();
    await page.goto('https://one.dat.com', { waitUntil: 'networkidle' });

    // TODO: Replace selectors and navigation steps with the current DAT login workflow
    await page.fill('input[name="username"]', config.datUsername);
    await page.fill('input[name="password"]', config.datPassword);
    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');
    await sendSessionEvent(config, 'INFO', 'DAT login sequence completed');
  } finally {
    await context.close();
  }
}

function maybeEncryptBundle(buffer: Buffer, encryptionKey?: string) {
  if (!encryptionKey) {
    return { buffer, encryption: undefined as string | undefined };
  }

  const keyBuffer = Buffer.from(encryptionKey, 'base64');
  if (keyBuffer.length !== 32) {
    throw new Error('SESSION_BUNDLE_ENCRYPTION_KEY must be a 32-byte base64 encoded string');
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([Buffer.from('DSLB'), iv, authTag, encrypted]);

  return { buffer: payload, encryption: 'AES-256-GCM' as const };
}

function createBundleFromProfile(profileDir: string, encryptionKey?: string) {
  const zip = new AdmZip();
  zip.addLocalFolder(profileDir);
  const rawBuffer = zip.toBuffer();
  const { buffer, encryption } = maybeEncryptBundle(rawBuffer, encryptionKey);
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  return { buffer, checksum, encryption } as const;
}

async function uploadBundle(config: SeederConfig, bundle: { buffer: Buffer; checksum: string; encryption?: string }) {
  const uploadResponse = await axios.post(
    `${config.apiBaseUrl}/sessions/${config.sessionId}/request-upload`,
    { contentType: 'application/zip' },
    { headers: { Authorization: `Bearer ${config.apiToken}` } }
  );

  const { url, bundleKey } = uploadResponse.data as { url: string; bundleKey: string };

  await axios.put(url, bundle.buffer, {
    headers: { 'Content-Type': 'application/zip' },
    maxBodyLength: Infinity,
  });

  await axios.post(
    `${config.apiBaseUrl}/sessions/${config.sessionId}/complete-upload`,
    { checksum: bundle.checksum, fileSizeBytes: bundle.buffer.length, encryption: bundle.encryption },
    { headers: { Authorization: `Bearer ${config.apiToken}` } }
  );

  await sendSessionEvent(config, 'INFO', 'Session bundle uploaded', {
    bundleKey,
    size: bundle.buffer.length,
    encryption: bundle.encryption ?? 'none',
  });
}

async function main() {
  const config = resolveConfig();
  await sendSessionEvent(config, 'INFO', 'Seeder started');

  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), `dat-seeder-${config.sessionId}-`));
  try {
    await loginToDat(sessionDir, config);
    const bundle = createBundleFromProfile(sessionDir, config.encryptionKey);
    await sendSessionEvent(config, 'INFO', 'Session bundle prepared', {
      checksum: bundle.checksum,
      encryption: bundle.encryption ?? 'none',
    });
    await uploadBundle(config, bundle);
  } catch (error) {
    await sendSessionEvent(config, 'ERROR', 'Seeder failure', {
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
