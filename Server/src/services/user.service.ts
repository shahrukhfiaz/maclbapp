import { prisma } from '../db/client';
import { AppError } from '../utils/appError';
import { hashPassword } from '../utils/password';
import { assignLatestDatSessionToUser } from './sessionAssignment.service';
import type { Prisma, UserRole, UserStatus } from '@prisma/client';

interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
  status?: UserStatus;
}

interface UpdateUserInput {
  email?: string;
  password?: string;
  role?: UserRole;
  status?: UserStatus;
}

export async function listUsers(params: { skip?: number; take?: number }): Promise<{ data: unknown[]; count: number }> {
  const [data, count] = await prisma.$transaction([
    prisma.user.findMany({
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
    prisma.user.count(),
  ]);

  return { data, count };
}

export async function createUser(input: CreateUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError('Email already in use', 409);
  }

  const passwordHash = await hashPassword(input.password);
  
  // Create the user
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: input.role,
      status: input.status ?? 'ACTIVE',
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  // Automatically assign the latest DAT session to the new user
  try {
    const assignedSession = await assignLatestDatSessionToUser(user.id);
    console.log(`Automatically assigned DAT session ${assignedSession.name} to user ${user.email}`);
  } catch (error) {
    console.warn(`Failed to assign DAT session to user ${user.email}:`, error);
    // Don't fail user creation if session assignment fails
  }

  return user;
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const data: Prisma.UserUpdateInput = {};

  if (input.email && input.email !== user.email) {
    const emailExists = await prisma.user.findUnique({ where: { email: input.email } });
    if (emailExists) {
      throw new AppError('Email already in use', 409);
    }
    data.email = input.email;
  }

  if (input.password) {
    data.passwordHash = await hashPassword(input.password);
  }

  if (input.role) {
    data.role = input.role;
  }

  if (input.status) {
    data.status = input.status;
  }

  return prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
}

export async function deleteUser(id: string): Promise<{ id: string; email: string }> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  await prisma.user.delete({ where: { id } });
  
  return { id: user.id, email: user.email };
}

