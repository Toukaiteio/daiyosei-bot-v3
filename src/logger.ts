import pino from 'pino';
import type { LogLevel } from './config/schema.js';

export type Logger = pino.Logger;

const LOG_BUFFER_SIZE = 100;
const logBuffer: any[] = [];

export function createLogger(level: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info') {
  return pino(
    {
      level,
    },
    pino.multistream([
      { stream: process.stdout },
      {
        stream: {
          write(msg: string) {
            try {
              const log = JSON.parse(msg);
              logBuffer.push(log);
              if (logBuffer.length > LOG_BUFFER_SIZE) {
                logBuffer.shift();
              }
            } catch {
              // ignore
            }
          },
        } as any,
      },
    ]),
  );
}

export function getRecentLogs() {
  return [...logBuffer];
}
