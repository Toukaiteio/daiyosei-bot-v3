import pino from 'pino';
const logger = pino({ level: 'info' });
logger.info('hello from pino');
console.log('hello from console.log');
