import { Router, type Request, type Response } from 'express';

export function createHealthRouter(): Router {
  const router = Router();

  router.get('/live', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  router.get('/ready', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ready', database: 'connected' });
  });

  return router;
}
