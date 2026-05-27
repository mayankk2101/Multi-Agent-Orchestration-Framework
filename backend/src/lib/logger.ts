import winston from 'winston';
import { getEnv } from '../config/env.js';

const createLogger = (label: string) => {
  const env = getEnv();

  const logger = winston.createLogger({
    level: env.LOG_LEVEL,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.label({ label }),
      winston.format.printf(({ level, message, timestamp, label, stack, ...meta }) => {
        let log = `${timestamp} [${label}] ${level.toUpperCase()}: ${message}`;
        if (Object.keys(meta).length > 0) {
          log += ` ${JSON.stringify(meta)}`;
        }
        if (stack) {
          log += `\n${stack}`;
        }
        return log;
      })
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
      }),
    ],
  });

  return logger;
};

export const logger = createLogger('app');

export const createRequestLogger = (requestId: string) => {
  return createLogger(`req:${requestId}`);
};
