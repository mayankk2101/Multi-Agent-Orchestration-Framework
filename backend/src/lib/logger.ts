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

// The default app logger reads LOG_LEVEL from the environment, which is only
// available after loadEnv() runs in main(). Constructing it eagerly at module
// evaluation time would call getEnv() before the environment is loaded and
// crash on import. Instead we memoize it and create it lazily on first use,
// by which point main() has already loaded the environment.
let appLogger: winston.Logger | undefined;

const getAppLogger = (): winston.Logger => {
  if (!appLogger) {
    appLogger = createLogger('app');
  }
  return appLogger;
};

// Preserve the existing `logger.info(...)` API while deferring env access until
// the first property access (a log call), rather than at import time.
export const logger: winston.Logger = new Proxy({} as winston.Logger, {
  get(_target, prop, receiver) {
    return Reflect.get(getAppLogger(), prop, receiver);
  },
  set(_target, prop, value, receiver) {
    return Reflect.set(getAppLogger(), prop, value, receiver);
  },
});

export const createRequestLogger = (requestId: string) => {
  return createLogger(`req:${requestId}`);
};
