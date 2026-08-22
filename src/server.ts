import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './shared/logger.js';

const app = createApp();

const server = app.listen(config.PORT, () => {
  logger.info(`🚀 GlobeTrotter Backend listening on port ${config.PORT} [${config.NODE_ENV}]`);
  logger.info(`👉 API v1 available at http://localhost:${config.PORT}/api/v1`);
  logger.info(`👉 Health check at http://localhost:${config.PORT}/health/live`);
});

const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
