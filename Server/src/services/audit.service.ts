import { prisma } from '../db/client';
import type { Prisma } from '@prisma/client';

interface CreateAuditLogInput {
  actorId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export function recordAuditLog(payload: CreateAuditLogInput) {
  const metadata = payload.metadata ? (payload.metadata as Prisma.InputJsonValue) : undefined;
  return prisma.auditLog.create({
    data: {
      action: payload.action,
      targetType: payload.targetType,
      actorId: payload.actorId ?? undefined,
      targetId: payload.targetId ?? undefined,
      metadata,
      ipAddress: payload.ipAddress ?? undefined,
    },
  });
}

export function listAuditLogs(limit = 100) {
  return prisma.auditLog.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      actor: { select: { id: true, email: true, role: true } },
    },
  });
}