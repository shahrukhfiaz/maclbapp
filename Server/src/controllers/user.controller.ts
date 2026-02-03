import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { createUser, deleteUser, listUsers, updateUser } from '../services/user.service';
import { recordAuditLog } from '../services/audit.service';
import type { AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../utils/appError';

const userCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'USER']),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']).optional(),
});

const userUpdateSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'USER']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']).optional(),
});

export const listUsersHandler = asyncHandler(async (req, res) => {
  const skip = req.query.skip ? Number(req.query.skip) : undefined;
  const take = req.query.take ? Number(req.query.take) : undefined;
  const result = await listUsers({ skip, take });
  return res.status(200).json({ users: result.data, total: result.count });
});

export const createUserHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = userCreateSchema.parse(req.body);
  const user = await createUser(payload);
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'USER_CREATED',
    targetType: 'USER',
    targetId: user.id,
    metadata: { email: user.email, role: user.role },
  });
  return res.status(201).json(user);
});

export const updateUserHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const payload = userUpdateSchema.parse(req.body);
  const { id } = req.params;
  if (!id) {
    throw new AppError('User id parameter is required', 400);
  }
  const user = await updateUser(id, payload);
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'USER_UPDATED',
    targetType: 'USER',
    targetId: user.id,
    metadata: payload,
  });
  return res.status(200).json(user);
});

export const deleteUserHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!id) {
    throw new AppError('User id parameter is required', 400);
  }
  
  const user = await deleteUser(id);
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'USER_DELETED',
    targetType: 'USER',
    targetId: id,
    metadata: { deletedUser: user.email, deletedBy: req.user?.id },
  });
  
  return res.status(200).json({ 
    message: 'User deleted successfully',
    userId: id,
    email: user.email 
  });
});

// New endpoint for changing user password
export const changeUserPasswordHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { password } = req.body;
  
  if (!id) {
    throw new AppError('User id parameter is required', 400);
  }
  
  if (!password || password.length < 6) {
    throw new AppError('Password must be at least 6 characters long', 400);
  }
  
  const user = await updateUser(id, { password });
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'USER_PASSWORD_CHANGED',
    targetType: 'USER',
    targetId: id,
    metadata: { changedBy: req.user?.id },
  });
  
  return res.status(200).json({ 
    message: 'Password updated successfully',
    userId: user.id,
    email: user.email 
  });
});

// New endpoint for toggling user status
export const toggleUserStatusHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  if (!id) {
    throw new AppError('User id parameter is required', 400);
  }
  
  if (!status || !['ACTIVE', 'SUSPENDED', 'DISABLED'].includes(status)) {
    throw new AppError('Valid status is required (ACTIVE, SUSPENDED, DISABLED)', 400);
  }
  
  const user = await updateUser(id, { status });
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'USER_STATUS_CHANGED',
    targetType: 'USER',
    targetId: id,
    metadata: { newStatus: status, changedBy: req.user?.id },
  });
  
  return res.status(200).json({ 
    message: 'User status updated successfully',
    userId: user.id,
    email: user.email,
    status: user.status 
  });
});

// New endpoint for updating user role
export const updateUserRoleHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { role } = req.body;
  
  if (!id) {
    throw new AppError('User id parameter is required', 400);
  }
  
  if (!role || !['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'USER'].includes(role)) {
    throw new AppError('Valid role is required (SUPER_ADMIN, ADMIN, SUPPORT, USER)', 400);
  }
  
  const user = await updateUser(id, { role });
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'USER_ROLE_CHANGED',
    targetType: 'USER',
    targetId: id,
    metadata: { newRole: role, changedBy: req.user?.id },
  });
  
  return res.status(200).json({ 
    message: 'User role updated successfully',
    userId: user.id,
    email: user.email,
    role: user.role 
  });
});