import { prisma } from '../db/client';
import { AppError } from '../utils/appError';

const SHARED_SESSION_NAME = 'Shared DAT Session';
const SHARED_SESSION_DESCRIPTION = 'Master DAT session shared among all users';

/**
 * Creates or gets the shared DAT session that all users can access
 * If no session exists, creates a PENDING session that needs to be set up by super admin
 */
export async function getOrCreateSharedSession() {
  // First, try to find an existing shared session
  let sharedSession = await prisma.datSession.findFirst({
    where: {
      name: SHARED_SESSION_NAME,
    },
    include: {
      domain: true,
      proxy: true,
    },
  });

  // If no shared session exists, create one in PENDING status
  if (!sharedSession) {
    console.log('Creating new shared DAT session (PENDING - needs super admin setup)...');
    
    // Get the DAT domain (or create it if it doesn't exist)
    let domain = await prisma.domain.findFirst({
      where: { baseUrl: 'https://one.dat.com' }
    });
    if (!domain) {
      domain = await prisma.domain.create({
        data: {
          label: 'DAT One',
          baseUrl: 'https://one.dat.com',
          description: 'Main DAT platform for session management',
        },
      });
    }

    // Get the first available proxy (optional)
    const proxy = await prisma.proxy.findFirst({
      where: { isActive: true },
    });

    // Create the shared session in PENDING status
    sharedSession = await prisma.datSession.create({
      data: {
        name: SHARED_SESSION_NAME,
        status: 'PENDING', // Will be set to READY after super admin setup
        domainId: domain.id,
        proxyId: proxy?.id,
        notes: `${SHARED_SESSION_DESCRIPTION} - Needs super admin setup`,
        // Don't assign to any specific user - this is shared
        assignedUserId: null,
      },
      include: {
        domain: true,
        proxy: true,
      },
    });

    console.log(`Created shared session (PENDING): ${sharedSession.id}`);
  }

  return sharedSession;
}

/**
 * Assigns the shared session to a user (but doesn't actually assign it in the database)
 * This allows all users to access the same session
 */
export async function assignSharedSessionToUser(userId: string) {
  const sharedSession = await getOrCreateSharedSession();
  
  // Log that the user is accessing the shared session
  console.log(`User ${userId} accessing shared session ${sharedSession.id}`);
  
  // Return the shared session as if it were assigned to the user
  return {
    ...sharedSession,
    assignedUserId: userId, // Temporarily set for the response
  };
}

/**
 * Marks the shared session as ready after super admin setup
 */
export async function markSharedSessionAsReady(sessionId: string, superAdminId: string) {
  const session = await prisma.datSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new AppError('Session not found', 404);
  }

  if (session.name !== SHARED_SESSION_NAME) {
    throw new AppError('This is not the shared session', 400);
  }

  // Update the session to READY status
  const updatedSession = await prisma.datSession.update({
    where: { id: sessionId },
    data: {
      status: 'READY',
      notes: `${SHARED_SESSION_DESCRIPTION} - Set up by super admin`,
      lastLoginAt: new Date(),
    },
  });

  console.log(`Shared session ${sessionId} marked as READY by super admin ${superAdminId}`);
  return updatedSession;
}

/**
 * Gets session statistics for the shared session system
 */
export async function getSharedSessionStats() {
  const sharedSession = await getOrCreateSharedSession();
  const totalUsers = await prisma.user.count({
    where: { status: 'ACTIVE' },
  });

  return {
    sharedSessionId: sharedSession.id,
    sharedSessionName: sharedSession.name,
    sharedSessionStatus: sharedSession.status,
    totalActiveUsers: totalUsers,
    sessionDomain: sharedSession.domain?.baseUrl || 'https://one.dat.com',
    sessionProxy: sharedSession.proxy?.name || 'No proxy',
    needsSetup: sharedSession.status === 'PENDING',
  };
}
