import { prisma } from '../db/client';
import { AppError } from '../utils/appError';
import type { DatSessionStatus } from '@prisma/client';

interface CreateSessionInput {
  name: string;
  proxyId?: string;
  domainId?: string;
  assignedUserId?: string;
  notes?: string;
}

interface UpdateSessionInput {
  proxyId?: string | null;
  domainId?: string | null;
  assignedUserId?: string | null;
  status?: DatSessionStatus;
  notes?: string | null;
  bundleKey?: string | null;
  bundleChecksum?: string | null;
  bundleEncryption?: string | null;
  lastSyncedAt?: Date | null;
}

export function listSessions() {
  return prisma.datSession.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      proxy: true,
      domain: true,
      assignedUser: {
        select: { id: true, email: true, role: true },
      },
    },
  });
}

export async function createSession(input: CreateSessionInput) {
  const existing = await prisma.datSession.findUnique({ where: { name: input.name } });
  if (existing) {
    throw new AppError('Session name already exists', 409);
  }

  if (input.assignedUserId) {
    await ensureUserExists(input.assignedUserId);
  }

  if (input.proxyId) {
    await ensureProxyExists(input.proxyId);
  }

  if (input.domainId) {
    await ensureDomainExists(input.domainId);
  }

  return prisma.datSession.create({
    data: {
      name: input.name,
      proxyId: input.proxyId,
      domainId: input.domainId,
      assignedUserId: input.assignedUserId,
      notes: input.notes,
      status: 'PENDING',
    },
  });
}

export async function updateSession(id: string, input: UpdateSessionInput) {
  const session = await prisma.datSession.findUnique({ where: { id } });
  if (!session) {
    throw new AppError('Session not found', 404);
  }

  if (input.assignedUserId) {
    await ensureUserExists(input.assignedUserId);
  }

  if (input.proxyId) {
    await ensureProxyExists(input.proxyId);
  }

  if (input.domainId) {
    await ensureDomainExists(input.domainId);
  }

  return prisma.datSession.update({
    where: { id },
    data: input,
  });
}

export async function deleteSession(id: string) {
  const session = await prisma.datSession.findUnique({ where: { id } });
  if (!session) {
    throw new AppError('Session not found', 404);
  }

  await prisma.datSession.delete({ where: { id } });
}

async function ensureUserExists(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('Assigned user not found', 400);
  }
}

async function ensureProxyExists(proxyId: string) {
  const proxy = await prisma.proxy.findUnique({ where: { id: proxyId } });
  if (!proxy) {
    throw new AppError('Proxy not found', 400);
  }
}

async function ensureDomainExists(domainId: string) {
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) {
    throw new AppError('Domain not found', 400);
  }
}
