import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { correlationIdMiddleware } from './api/middleware/correlation-id.js';
import { requestLogger } from './api/middleware/request-logger.js';
import { errorHandler } from './api/middleware/error-handler.js';
import { createHealthRouter } from './api/health.router.js';
import { createApiRouter } from './api/router.js';
import { defaultRepositories, type Repositories } from './infrastructure/db/repositories/index.js';
import { StorageAdapter } from './infrastructure/storage/storage-adapter.js';
import { EmailSender } from './infrastructure/email/email-sender.js';
import { JobRegistry } from './infrastructure/jobs/job-registry.js';
import type { StorageService, EmailService, JobService } from './application/ports/services.js';

export interface AppDependencies {
  repos?: Repositories;
  storageService?: StorageService;
  emailService?: EmailService;
  jobService?: JobService;
}

export function createApp(deps: AppDependencies = {}): Express {
  const app = express();

  const repos = deps.repos || defaultRepositories;
  const storageService = deps.storageService || new StorageAdapter();
  const emailService = deps.emailService || new EmailSender();
  const jobService = deps.jobService || new JobRegistry();

  // Security & standard middlewares
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(
    cors({
      origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(correlationIdMiddleware);
  app.use(requestLogger);

  // Serve frontend static assets
  app.use(express.static('frontend'));

  // Health checks
  app.use('/health', createHealthRouter());

  // API v1 routes
  app.use(
    '/api/v1',
    createApiRouter({
      repos,
      storageService,
      jobService,
    })
  );

  // Global error handler
  app.use(errorHandler);

  return app;
}

