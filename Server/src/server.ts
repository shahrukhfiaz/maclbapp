import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import apiRouter from './routes';
import { errorHandler } from './middleware/errorHandler';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectDatabase } from './db/client';
import { bootstrapSuperAdmin } from './services/auth.service';
import { startBillingJob } from './jobs/billing.job';

const app = express();

// Temporarily disable helmet for admin panel development
// app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1', apiRouter);
app.use(errorHandler);

async function start() {
  try {
    await connectDatabase();
    await bootstrapSuperAdmin('superadmin@digitalstorming.com', 'ChangeMeSuperSecure123!');

    // Start billing background job
    startBillingJob();

    app.listen(env.PORT, () => {
      logger.info('DAT Loadboard backend listening on port ' + env.PORT);
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

void start();
