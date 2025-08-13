import { Request, Response } from 'express';

import { HealthService } from '@health/application/HealthService';



/**
 * Health Check Controller - Presentation Layer
 */
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  public async getHealth(_req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await this.healthService.checkHealth();
      
      const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
      
      res.status(statusCode).json({
        status: healthStatus.status,
        timestamp: healthStatus.timestamp,
        uptime: healthStatus.uptime,
        version: healthStatus.version,
        services: healthStatus.services,
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  public async getReadiness(_req: Request, res: Response): Promise<void> {
    try {
      const readinessStatus = await this.healthService.checkReadiness();
      
      const statusCode = readinessStatus.ready ? 200 : 503;
      
      res.status(statusCode).json({
        ready: readinessStatus.ready,
        timestamp: readinessStatus.timestamp,
        services: readinessStatus.services,
      });
    } catch (error) {
      res.status(503).json({
        ready: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
