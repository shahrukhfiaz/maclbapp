import { prisma } from '../db/client';
import { AppError } from '../utils/appError';
import type { BillingCycle, PaymentStatus, User } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Calculate the end date of a billing cycle based on start date and cycle type
 */
export function calculateCycleEndDate(startDate: Date, cycle: BillingCycle): Date {
  const endDate = new Date(startDate);
  
  switch (cycle) {
    case 'DAILY':
      endDate.setDate(endDate.getDate() + 1);
      break;
    case 'WEEKLY':
      endDate.setDate(endDate.getDate() + 7);
      break;
    case 'MONTHLY':
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    case 'THREE_MONTHS':
      endDate.setMonth(endDate.getMonth() + 3);
      break;
    case 'HALF_YEAR':
      endDate.setMonth(endDate.getMonth() + 6);
      break;
    case 'YEARLY':
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;
    default:
      throw new AppError(`Invalid billing cycle: ${cycle}`, 400);
  }
  
  return endDate;
}

/**
 * Start a billing cycle for a user
 */
export async function startBillingCycle(
  userId: string,
  cycle: BillingCycle,
  startDate?: Date
): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const cycleStart = startDate || new Date();
  const cycleEnd = calculateCycleEndDate(cycleStart, cycle);

  // End any active trial
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      billingCycle: cycle,
      billingCycleStartDate: cycleStart,
      billingCycleEndDate: cycleEnd,
      isBillingActive: true,
      isTrialActive: false,
      trialStartDate: null,
      trialEndDate: null,
      lastBillingCheckAt: new Date(),
    },
  });

  // Log to billing history
  await prisma.billingHistory.create({
    data: {
      userId,
      action: 'CYCLE_STARTED',
      details: {
        cycle,
        startDate: cycleStart.toISOString(),
        endDate: cycleEnd.toISOString(),
      },
    },
  });

  return updatedUser;
}

/**
 * Add a payment and extend the billing cycle
 */
export async function addPayment(
  userId: string,
  cycle: BillingCycle,
  amount: number,
  memo: string | null,
  adminId: string | null
): Promise<{ payment: any; user: User }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const paymentDate = new Date();
  const cycleStart = user.billingCycleEndDate && user.billingCycleEndDate > paymentDate
    ? user.billingCycleEndDate
    : paymentDate;
  const cycleEnd = calculateCycleEndDate(cycleStart, cycle);

  // Create payment record
  const payment = await prisma.payment.create({
    data: {
      userId,
      amount: new Decimal(amount),
      billingCycle: cycle,
      status: 'PAID',
      paymentDate,
      cycleStartDate: cycleStart,
      cycleEndDate: cycleEnd,
      memo: memo || null,
      createdBy: adminId || null,
    },
  });

  // Update user billing cycle
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      billingCycle: cycle,
      billingCycleStartDate: cycleStart,
      billingCycleEndDate: cycleEnd,
      isBillingActive: true,
      isTrialActive: false,
      lastBillingCheckAt: new Date(),
    },
  });

  // Log to billing history
  await prisma.billingHistory.create({
    data: {
      userId,
      action: 'PAYMENT_ADDED',
      details: {
        paymentId: payment.id,
        amount: amount.toString(),
        cycle,
        memo: memo || null,
        cycleStartDate: cycleStart.toISOString(),
        cycleEndDate: cycleEnd.toISOString(),
      },
    },
  });

  return { payment, user: updatedUser };
}

/**
 * Set trial period for a user
 */
export async function setTrialPeriod(
  userId: string,
  hours: number
): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const trialStart = new Date();
  const trialEnd = new Date(trialStart);
  trialEnd.setHours(trialEnd.getHours() + hours);

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      trialPeriodHours: hours,
      trialStartDate: trialStart,
      trialEndDate: trialEnd,
      isTrialActive: true,
      isBillingActive: false,
      billingCycle: null,
      billingCycleStartDate: null,
      billingCycleEndDate: null,
      lastBillingCheckAt: new Date(),
    },
  });

  // Log to billing history
  await prisma.billingHistory.create({
    data: {
      userId,
      action: 'TRIAL_STARTED',
      details: {
        hours,
        startDate: trialStart.toISOString(),
        endDate: trialEnd.toISOString(),
      },
    },
  });

  return updatedUser;
}

/**
 * Get billing status for a user
 */
export async function getUserBillingStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const now = new Date();
  let isExpired = false;
  let daysRemaining: number | null = null;
  let statusMessage = '';

  // Check trial expiration
  if (user.isTrialActive && user.trialEndDate) {
    if (user.trialEndDate < now) {
      isExpired = true;
      statusMessage = 'Trial period expired';
    } else {
      const diff = user.trialEndDate.getTime() - now.getTime();
      daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
      statusMessage = `Trial active - ${daysRemaining} day(s) remaining`;
    }
  }
  // Check billing cycle expiration
  else if (user.isBillingActive && user.billingCycleEndDate) {
    if (user.billingCycleEndDate < now) {
      isExpired = true;
      statusMessage = 'Billing cycle expired';
    } else {
      const diff = user.billingCycleEndDate.getTime() - now.getTime();
      daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
      statusMessage = `Active - ${daysRemaining} day(s) remaining`;
    }
  } else {
    statusMessage = 'No billing cycle set';
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      billingCycle: user.billingCycle,
      billingCycleStartDate: user.billingCycleStartDate,
      billingCycleEndDate: user.billingCycleEndDate,
      trialPeriodHours: user.trialPeriodHours,
      trialStartDate: user.trialStartDate,
      trialEndDate: user.trialEndDate,
      isTrialActive: user.isTrialActive,
      isBillingActive: user.isBillingActive,
    },
    isExpired,
    daysRemaining,
    statusMessage,
    recentPayments: user.payments.map(p => ({
      id: p.id,
      amount: p.amount.toString(),
      billingCycle: p.billingCycle,
      status: p.status,
      paymentDate: p.paymentDate,
      cycleStartDate: p.cycleStartDate,
      cycleEndDate: p.cycleEndDate,
      memo: p.memo,
    })),
  };
}

/**
 * Get payment history for a user
 */
export async function getPaymentHistory(userId: string) {
  const payments = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return payments.map(p => ({
    id: p.id,
    amount: p.amount.toString(),
    billingCycle: p.billingCycle,
    status: p.status,
    paymentDate: p.paymentDate,
    cycleStartDate: p.cycleStartDate,
    cycleEndDate: p.cycleEndDate,
    memo: p.memo,
    createdBy: p.createdBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

/**
 * Get billing history (audit trail) for a user
 */
export async function getBillingHistory(userId: string) {
  const history = await prisma.billingHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return history;
}

/**
 * Check and disable expired accounts
 */
export async function checkAndDisableExpiredAccounts(): Promise<{
  disabled: number;
  expiredUsers: string[];
}> {
  const now = new Date();
  const expiredUsers: string[] = [];

  // Find users with expired billing cycles
  const expiredBillingUsers = await prisma.user.findMany({
    where: {
      isBillingActive: true,
      billingCycleEndDate: {
        lt: now,
      },
      status: {
        not: 'DISABLED',
      },
    },
  });

  // Find users with expired trials
  const expiredTrialUsers = await prisma.user.findMany({
    where: {
      isTrialActive: true,
      trialEndDate: {
        lt: now,
      },
      status: {
        not: 'DISABLED',
      },
    },
  });

  // Disable expired billing cycle users
  for (const user of expiredBillingUsers) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'DISABLED',
        isBillingActive: false,
        lastBillingCheckAt: now,
      },
    });

    await prisma.billingHistory.create({
      data: {
        userId: user.id,
        action: 'AUTO_DISABLED',
        details: {
          reason: 'Billing cycle expired',
          expiredDate: user.billingCycleEndDate?.toISOString(),
        },
      },
    });

    expiredUsers.push(user.id);
  }

  // Disable expired trial users
  for (const user of expiredTrialUsers) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: 'DISABLED',
        isTrialActive: false,
        lastBillingCheckAt: now,
      },
    });

    await prisma.billingHistory.create({
      data: {
        userId: user.id,
        action: 'AUTO_DISABLED',
        details: {
          reason: 'Trial period expired',
          expiredDate: user.trialEndDate?.toISOString(),
        },
      },
    });

    expiredUsers.push(user.id);
  }

  return {
    disabled: expiredUsers.length,
    expiredUsers,
  };
}

/**
 * Get list of expired accounts
 */
export async function getExpiredAccounts() {
  const now = new Date();

  const expiredBilling = await prisma.user.findMany({
    where: {
      isBillingActive: true,
      billingCycleEndDate: {
        lt: now,
      },
    },
    select: {
      id: true,
      email: true,
      billingCycle: true,
      billingCycleEndDate: true,
      status: true,
    },
  });

  const expiredTrials = await prisma.user.findMany({
    where: {
      isTrialActive: true,
      trialEndDate: {
        lt: now,
      },
    },
    select: {
      id: true,
      email: true,
      trialEndDate: true,
      status: true,
    },
  });

  return {
    expiredBilling,
    expiredTrials,
    total: expiredBilling.length + expiredTrials.length,
  };
}

