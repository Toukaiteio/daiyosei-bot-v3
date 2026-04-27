import 'dotenv/config';
import { createApp } from './app.js';
import { loadConfig } from './config/index.js';
import { createLogger } from './logger.js';

async function main() {
  const config = loadConfig(process.env);
  const logger = createLogger(config.logging.level);
  logger.info('booting daiyosei bot foundation');
  const app = await createApp({ config, logger });

  await app.start();
  logger.info(
    {
      apiBase: `http://${config.http.host}:${config.http.port}`,
      logLevel: config.logging.level,
      oneBotEnabled: config.oneBot.enabled,
      oneBotPath: config.oneBot.path,
      webUi: config.webUi.autoStart
        ? `enabled at http://${config.http.host}:${config.http.port}/`
        : 'disabled, run npm run web:dev for the dashboard',
    },
    'runtime ready',
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutdown requested');
    await app.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  const logger = createLogger((process.env.LOG_LEVEL as any) ?? 'info');
  console.error('FATAL STARTUP ERROR:', error);
  logger.error({ 
    msg: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    error 
  }, 'fatal startup error');
  logger.error('startup failed, process will exit');
  process.exit(1);
});
