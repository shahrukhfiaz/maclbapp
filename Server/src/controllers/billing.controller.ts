import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  startBillingCycle,
  addPayment,
  setTrialPeriod,
  getUserBillingStatus,
  getPaymentHistory,
  getBillingHistory,
  checkAndDisableExpiredAccounts,
  getExpiredAccounts,
} from '../services/billing.service';
import { recordAuditLog } from '../services/audit.service';
import type { AuthenticatedRequest } from '../middleware/auth';
import { AppError } from '../utils/appError';

const startCycleSchema = z.object({
  cycle: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'THREE_MONTHS', 'HALF_YEAR', 'YEARLY']),
  startDate: z.string().datetime().optional(),
});

const addPaymentSchema = z.object({
  cycle: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'THREE_MONTHS', 'HALF_YEAR', 'YEARLY']),
  amount: z.number().positive(),
  memo: z.string().optional().nullable(),
});

const setTrialSchema = z.object({
  hours: z.number().int().positive(),
});

export const startBillingCycleHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;
  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  const payload = startCycleSchema.parse(req.body);
  const startDate = payload.startDate ? new Date(payload.startDate) : undefined;
  
  const user = await startBillingCycle(userId, payload.cycle, startDate);
  
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'BILLING_CYCLE_STARTED',
    targetType: 'USER',
    targetId: userId,
    metadata: { cycle: payload.cycle, startDate: user.billingCycleStartDate },
  });

  return res.status(200).json({ user });
});

export const addPaymentHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;
  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  const payload = addPaymentSchema.parse(req.body);
  const result = await addPayment(userId, payload.cycle, payload.amount, payload.memo || null, req.user?.id || null);
  
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'PAYMENT_ADDED',
    targetType: 'USER',
    targetId: userId,
    metadata: { 
      amount: payload.amount, 
      cycle: payload.cycle,
      paymentId: result.payment.id,
    },
  });

  return res.status(200).json({ payment: result.payment, user: result.user });
});

export const getUserBillingStatusHandler = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  const status = await getUserBillingStatus(userId);
  return res.status(200).json(status);
});

export const getPaymentHistoryHandler = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  const payments = await getPaymentHistory(userId);
  return res.status(200).json({ payments });
});

export const getBillingHistoryHandler = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  const history = await getBillingHistory(userId);
  return res.status(200).json({ history });
});

export const setTrialPeriodHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { userId } = req.params;
  if (!userId) {
    throw new AppError('User ID is required', 400);
  }

  const payload = setTrialSchema.parse(req.body);
  const user = await setTrialPeriod(userId, payload.hours);
  
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'TRIAL_PERIOD_SET',
    targetType: 'USER',
    targetId: userId,
    metadata: { hours: payload.hours },
  });

  return res.status(200).json({ user });
});

export const getExpiredAccountsHandler = asyncHandler(async (req, res) => {
  const expired = await getExpiredAccounts();
  return res.status(200).json(expired);
});

export const checkExpiredAccountsHandler = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const result = await checkAndDisableExpiredAccounts();
  
  await recordAuditLog({
    actorId: req.user?.id,
    action: 'EXPIRED_ACCOUNTS_CHECKED',
    targetType: 'SYSTEM',
    metadata: { disabled: result.disabled, expiredUsers: result.expiredUsers },
  });

  return res.status(200).json(result);
});

