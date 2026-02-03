import cron from 'node-cron';
import { logger } from '../config/logger';
import { checkAndDisableExpiredAccounts } from '../services/billing.service';

let billingJob: cron.ScheduledTask | null = null;

/**
 * Start the billing background job
 * Runs every hour to check for expired accounts and trials
 */
export function startBillingJob(): void {
  if (billingJob) {
    logger.warn('Billing job is already running');
    return;
  }

  logger.info('Starting billing background job (runs every hour)');

  // Run every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
  billingJob = cron.schedule('0 * * * *', async () => {
    try {
      logger.info('Running billing expiration check...');
      const result = await checkAndDisableExpiredAccounts();
      
      if (result.disabled > 0) {
        logger.warn(`Disabled ${result.disabled} expired account(s)`, {
          expiredUserIds: result.expiredUsers,
        });
      } else {
        logger.info('No expired accounts found');
      }
    } catch (error) {
      logger.error({ err: error }, 'Error in billing expiration check');
    }
  });

  // Also run immediately on startup to catch any accounts that expired while server was down
  setTimeout(async () => {
    try {
      logger.info('Running initial billing expiration check on startup...');
      const result = await checkAndDisableExpiredAccounts();
      
      if (result.disabled > 0) {
        logger.warn(`Disabled ${result.disabled} expired account(s) on startup`, {
          expiredUserIds: result.expiredUsers,
        });
      }
    } catch (error) {
      logger.error({ err: error }, 'Error in initial billing expiration check');
    }
  }, 5000); // Wait 5 seconds after server starts
}

/**
 * Stop the billing background job
 */
export function stopBillingJob(): void {
  if (billingJob) {
    billingJob.stop();
    billingJob = null;
    logger.info('Billing background job stopped');
  }
}

