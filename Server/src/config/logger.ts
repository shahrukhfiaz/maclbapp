import pino, { LoggerOptions } from 'pino';
import { env } from './env';

const isDev = env.NODE_ENV !== 'production';

const baseOptions: LoggerOptions = {
  level: isDev ? 'debug' : 'info',
};

const options: LoggerOptions = isDev
  ? {
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        },
      },
    }
  : baseOptions;

export const logger = pino(options);