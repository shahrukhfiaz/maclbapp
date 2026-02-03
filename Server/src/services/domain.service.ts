import { prisma } from '../db/client';
import { AppError } from '../utils/appError';

interface CreateDomainInput {
  label: string;
  baseUrl: string;
  description?: string;
}

interface UpdateDomainInput {
  label?: string;
  baseUrl?: string;
  description?: string | null;
  isMaintenance?: boolean;
}

export function listDomains() {
  return prisma.domain.findMany({ orderBy: { createdAt: 'desc' } });
}

export function createDomain(input: CreateDomainInput) {
  return prisma.domain.create({ data: input });
}

export async function updateDomain(id: string, input: UpdateDomainInput) {
  const domain = await prisma.domain.findUnique({ where: { id } });
  if (!domain) {
    throw new AppError('Domain not found', 404);
  }

  return prisma.domain.update({ where: { id }, data: input });
}

export async function deleteDomain(id: string): Promise<void> {
  const domain = await prisma.domain.findUnique({ where: { id } });
  if (!domain) {
    throw new AppError('Domain not found', 404);
  }

  const linkedSessions = await prisma.datSession.count({ where: { domainId: id } });
  if (linkedSessions > 0) {
    throw new AppError('Domain is assigned to active sessions', 409);
  }

  await prisma.domain.delete({ where: { id } });
}
