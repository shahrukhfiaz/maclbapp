import { prisma } from '../db/client';
import { env } from '../config/env';
import { AppError } from '../utils/appError';
import { createSessionBundleUploadUrl, completeBundleUpload } from './sessionBundle.service';
import { assignSharedSessionToUser } from './sharedSession.service';

interface DatSessionData {
  id: string;
  name: string;
  bundleKey?: string;
  status: string;
}

/**
 * Automatically assigns the shared DAT session to a user
 * All users get access to the same shared session
 */
export async function assignLatestDatSessionToUser(userId: string): Promise<DatSessionData> {
  // Use the shared session system instead of individual sessions
  const sharedSession = await assignSharedSessionToUser(userId);
  
  console.log(`Assigned shared DAT session to user ${userId}`);
  
  return {
    id: sharedSession.id,
    name: sharedSession.name,
    bundleKey: sharedSession.bundleKey || undefined,
    status: sharedSession.status,
  };
}

/**
 * Creates a new DAT session by triggering the seeder worker
 */
async function createNewDatSession(): Promise<any> {
  // Create a new session record first
  const newSession = await prisma.datSession.create({
    data: {
      name: `DAT-Session-${Date.now()}`,
      status: 'PENDING',
      notes: 'Auto-created session for user assignment',
    },
  });

  // Check if we have DAT credentials configured
  if (!env.DAT_MASTER_USERNAME || !env.DAT_MASTER_PASSWORD) {
    console.warn('DAT credentials not configured. Session created but not seeded.');
    return newSession;
  }

  // If we have credentials, we could trigger the seeder here
  // For now, we'll create the session and let the admin manually seed it
  // In a production system, you'd trigger the seeder worker here
  
  console.log(`Created new session ${newSession.id}. Ready for DAT seeding.`);
  return newSession;
}

/**
 * Gets all sessions assigned to a specific user (returns shared session for all users)
 */
export async function getUserSessions(userId: string): Promise<DatSessionData[]> {
  // All users get access to the shared session
  const sharedSession = await assignSharedSessionToUser(userId);
  
  return [{
    id: sharedSession.id,
    name: sharedSession.name,
    bundleKey: sharedSession.bundleKey || undefined,
    status: sharedSession.status,
  }];
}

/**
 * Unassigns a session from a user (makes it available for others)
 */
export async function unassignSessionFromUser(sessionId: string, userId: string): Promise<void> {
  const session = await prisma.datSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new AppError('Session not found', 404);
  }

  if (session.assignedUserId !== userId) {
    throw new AppError('Session not assigned to this user', 403);
  }

  await prisma.datSession.update({
    where: { id: sessionId },
    data: {
      assignedUserId: null,
      lastLoginAt: null,
    },
  });
}

/**
 * Gets statistics about session assignments
 */
export async function getSessionAssignmentStats() {
  const totalSessions = await prisma.datSession.count();
  const assignedSessions = await prisma.datSession.count({
    where: {
      assignedUserId: {
        not: null,
      },
    },
  });
  const readySessions = await prisma.datSession.count({
    where: {
      status: 'READY',
      assignedUserId: null,
    },
  });

  return {
    totalSessions,
    assignedSessions,
    availableSessions: readySessions,
    utilizationRate: totalSessions > 0 ? (assignedSessions / totalSessions) * 100 : 0,
  };
}
