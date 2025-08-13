import { Router } from 'express';

import { HealthService } from '@health/application/HealthService';
import { HealthController } from '@health/presentation/HealthController';



/**
 * Health Check Routes
 */
export function createHealthRoutes(): Router {
  const router = Router();
  const healthService = new HealthService();
  const healthController = new HealthController(healthService);

  // Health check endpoint - shows overall system health
  router.get('/health', (req, res) => {
    void healthController.getHealth(req, res);
  });

  // Readiness check endpoint - shows if system is ready to accept traffic
  router.get('/ready', (req, res) => {
    void healthController.getReadiness(req, res);
  });

  // Liveness check endpoint - simple ping to show service is alive
  router.get('/ping', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'pong',
    });
  });

  return router;
}
