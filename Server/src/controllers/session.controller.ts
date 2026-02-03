import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { createSession, deleteSession, listSessions, updateSession } from '../services/session.service';
import { getSessionAssignmentStats } from '../services/sessionAssignment.service';
import { recordAuditLog } from '../services/audit.service';
import type { AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../utils/appError';
import {
  completeBundleUpload,
  createSessionBundleDownloadUrl,
  createSessionBundleUploadUrl,
  recordSessionEvent,
} from '../services/sessionBundle.service';

const sessionCreateSchema = z.object({
  name: z.string().min(1),
  proxyId: z.string().optional(),
  domainId: z.string().optional(),
  assignedUserId: z.string().optional(),
  notes: z.string().optional(),
});

const sessionUpdateSchema = z.object({
  proxyId: z.string().nullable().optional(),
  domainId: z.string().nullable().optional(),
  assignedUserId: z.string().nullable().optional(),
  status: z.enum(['READY', 'PENDING', 'AUTH_ERROR', 'PROXY_ERROR', 'DOWNLOADING', 'UPLOADING', 'DISABLED']).optional(),
  notes: z.string().nullable().optional(),
  bundleKey: z.string().nullable().optional(),
  bundleChecksum: z.string().nullable().optional(),
  bundleEncryption: z.string().nullable().optional(),
});

const signedUrlRequestSchema = z.object({
  expiresInSeconds: z.number().int().min(60).max(3600).optional(),
});

const uploadSignedUrlSchema = signedUrlRequestSchema.extend({
  contentType: z.string().optional(),
});

const completeUploadSchema = z.object({
  checksum: z.string().min(1).optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  encryption: z.string().optional(),
});

const sessionEventSchema = z.object({
  level: z.enum(['INFO', 'WARN', 'ERROR']).default('INFO'),
  message: z.string().min(1),
  context: z.record(z.string(), z.any()).optional(),
});

export const listSessionsHandler = asyncHandler(async (_req, res) => {
  const sessions = await listSessions();
  return res.status(200).json(sessions);
});

export const createSessionHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = sessionCreateSchema.parse(req.body);
  const session = await createSession(payload);
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'SESSION_CREATED',
    targetType: 'DAT_SESSION',
    targetId: session.id,
  });
  return res.status(201).json(session);
});

export const updateSessionHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = sessionUpdateSchema.parse(req.body);
  const { id } = req.params;
  if (!id) {
    throw new AppError('Session id parameter is required', 400);
  }
  const session = await updateSession(id, payload);
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'SESSION_UPDATED',
    targetType: 'DAT_SESSION',
    targetId: session.id,
    metadata: payload,
  });
  return res.status(200).json(session);
});

export const deleteSessionHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!id) {
    throw new AppError('Session id parameter is required', 400);
  }
  await deleteSession(id);
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'SESSION_DELETED',
    targetType: 'DAT_SESSION',
    targetId: id,
  });
  return res.status(204).send();
});

export const requestSessionDownloadUrlHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!id) {
    throw new AppError('Session id parameter is required', 400);
  }
  const { expiresInSeconds } = signedUrlRequestSchema.parse(req.body ?? {});
  const result = await createSessionBundleDownloadUrl(id, expiresInSeconds);
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'SESSION_BUNDLE_DOWNLOAD_REQUESTED',
    targetType: 'DAT_SESSION',
    targetId: id,
    metadata: { expiresInSeconds: result.expiresInSeconds, bundleKey: result.bundleKey },
  });
  return res.status(200).json({
    url: result.url,
    expiresInSeconds: result.expiresInSeconds,
    bundleKey: result.bundleKey,
  });
});

export const requestSessionUploadUrlHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!id) {
    throw new AppError('Session id parameter is required', 400);
  }
  const payload = uploadSignedUrlSchema.parse(req.body ?? {});
  const result = await createSessionBundleUploadUrl(id, payload);
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'SESSION_BUNDLE_UPLOAD_REQUESTED',
    targetType: 'DAT_SESSION',
    targetId: id,
    metadata: { expiresInSeconds: result.expiresInSeconds, bundleKey: result.bundleKey },
  });
  return res.status(200).json(result);
});

export const completeSessionUploadHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!id) {
    throw new AppError('Session id parameter is required', 400);
  }
  const payload = completeUploadSchema.parse(req.body ?? {});
  await completeBundleUpload({
    sessionId: id,
    checksum: payload.checksum,
    fileSizeBytes: payload.fileSizeBytes,
    encryption: payload.encryption,
  });
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'SESSION_BUNDLE_UPLOAD_COMPLETED',
    targetType: 'DAT_SESSION',
    targetId: id,
    metadata: payload,
  });
  return res.status(204).send();
});

export const recordSessionEventHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!id) {
    throw new AppError('Session id parameter is required', 400);
  }
  const payload = sessionEventSchema.parse(req.body ?? {});
  await recordSessionEvent(id, payload.level, payload.message, payload.context ?? undefined);
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'SESSION_EVENT_RECORDED',
    targetType: 'DAT_SESSION',
    targetId: id,
    metadata: payload,
  });
  return res.status(202).json({ status: 'queued' });
});

export const getMySessionsHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) {
    throw new AppError('User not authenticated', 401);
  }
  
  // Import the shared session service
  const { assignSharedSessionToUser } = await import('../services/sharedSession.service');
  
  // Get the shared session for this user
  const sharedSession = await assignSharedSessionToUser(req.user.id);
  
  return res.status(200).json([sharedSession]);
});

export const getSessionAssignmentStatsHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const stats = await getSessionAssignmentStats();
  return res.json(stats);
});

export const getSharedSessionStatsHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { getSharedSessionStats } = await import('../services/sharedSession.service');
  const stats = await getSharedSessionStats();
  return res.json(stats);
});

export const markSharedSessionReadyHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  if (!req.user?.id) {
    throw new AppError('User not authenticated', 401);
  }

  if (req.user.role !== 'SUPER_ADMIN') {
    throw new AppError('Only super admin can mark shared session as ready', 403);
  }

  const { sessionId } = req.params;
  if (!sessionId) {
    throw new AppError('Session ID is required', 400);
  }

  const { markSharedSessionAsReady } = await import('../services/sharedSession.service');
  const updatedSession = await markSharedSessionAsReady(sessionId, req.user.id);

  await recordAuditLog({
    actorId: req.user.id,
    action: 'SHARED_SESSION_MARKED_READY',
    targetType: 'DAT_SESSION',
    targetId: sessionId,
    metadata: { status: 'READY' },
  });

  return res.json(updatedSession);
});
