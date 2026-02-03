import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { createDomain, deleteDomain, listDomains, updateDomain } from '../services/domain.service';
import { recordAuditLog } from '../services/audit.service';
import type { AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../utils/appError';

const domainCreateSchema = z.object({
  label: z.string().min(1),
  baseUrl: z.string().url(),
  description: z.string().optional(),
});

const domainUpdateSchema = domainCreateSchema.partial().extend({
  isMaintenance: z.boolean().optional(),
});

export const listDomainsHandler = asyncHandler(async (_req, res) => {
  const domains = await listDomains();
  return res.status(200).json(domains);
});

export const createDomainHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = domainCreateSchema.parse(req.body);
  const domain = await createDomain(payload);
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'DOMAIN_CREATED',
    targetType: 'DOMAIN',
    targetId: domain.id,
  });
  return res.status(201).json(domain);
});

export const updateDomainHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = domainUpdateSchema.parse(req.body);
  const { id } = req.params;
  if (!id) {
    throw new AppError('Domain id parameter is required', 400);
  }
  const domain = await updateDomain(id, payload);
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'DOMAIN_UPDATED',
    targetType: 'DOMAIN',
    targetId: domain.id,
    metadata: payload,
  });
  return res.status(200).json(domain);
});

export const deleteDomainHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!id) {
    throw new AppError('Domain id parameter is required', 400);
  }
  await deleteDomain(id);
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'DOMAIN_DELETED',
    targetType: 'DOMAIN',
    targetId: id,
  });
  return res.status(204).send();
});