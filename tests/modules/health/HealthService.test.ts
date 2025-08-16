import { HealthService, IServiceHealth } from '@health/application/HealthService';

describe('HealthService', () => {
  let healthService: HealthService;

  beforeEach(() => {
    healthService = new HealthService();
  });

  describe('checkHealth', () => {
    it('should return health status with all required fields', async () => {
      const healthStatus = await healthService.checkHealth();

      expect(healthStatus).toHaveProperty('status');
      expect(healthStatus).toHaveProperty('timestamp');
      expect(healthStatus).toHaveProperty('uptime');
      expect(healthStatus).toHaveProperty('version');
      expect(healthStatus).toHaveProperty('services');

      expect(typeof healthStatus.status).toBe('string');
      expect(['healthy', 'unhealthy']).toContain(healthStatus.status);
      expect(typeof healthStatus.timestamp).toBe('string');
      expect(typeof healthStatus.uptime).toBe('number');
      expect(typeof healthStatus.version).toBe('string');
      expect(typeof healthStatus.services).toBe('object');
    });

    it('should return valid timestamp in ISO format', async () => {
      const healthStatus = await healthService.checkHealth();
      
      expect(() => new Date(healthStatus.timestamp)).not.toThrow();
      expect(new Date(healthStatus.timestamp).toISOString()).toBe(healthStatus.timestamp);
    });

    it('should return positive uptime', async () => {
      const healthStatus = await healthService.checkHealth();
      
      expect(healthStatus.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should check all required services', async () => {
      const healthStatus = await healthService.checkHealth();
      
      expect(healthStatus.services).toHaveProperty('mongodb');
      expect(healthStatus.services).toHaveProperty('redis');
      expect(healthStatus.services).toHaveProperty('filesystem');

      // Each service should have status
      Object.values(healthStatus.services).forEach((service: IServiceHealth) => {
        expect(service).toHaveProperty('status');
        expect(['up', 'down']).toContain(service.status);
      });
    });

    it('should return healthy status when all services are up', async () => {
      const healthStatus = await healthService.checkHealth();
      
      const allServicesUp = Object.values(healthStatus.services)
        .every((service: IServiceHealth) => service.status === 'up');
      
      const expectedStatus = allServicesUp ? 'healthy' : 'unhealthy';
      expect(healthStatus.status).toBe(expectedStatus);
    });
  });

  describe('checkReadiness', () => {
    it('should return readiness status with all required fields', async () => {
      const readinessStatus = await healthService.checkReadiness();

      expect(readinessStatus).toHaveProperty('ready');
      expect(readinessStatus).toHaveProperty('timestamp');
      expect(readinessStatus).toHaveProperty('services');

      expect(typeof readinessStatus.ready).toBe('boolean');
      expect(typeof readinessStatus.timestamp).toBe('string');
      expect(typeof readinessStatus.services).toBe('object');
    });

    it('should return valid timestamp in ISO format', async () => {
      const readinessStatus = await healthService.checkReadiness();
      
      expect(() => new Date(readinessStatus.timestamp)).not.toThrow();
      expect(new Date(readinessStatus.timestamp).toISOString()).toBe(readinessStatus.timestamp);
    });

    it('should check critical services only', async () => {
      const readinessStatus = await healthService.checkReadiness();
      
      expect(readinessStatus.services).toHaveProperty('mongodb');
      expect(readinessStatus.services).toHaveProperty('redis');
      
      // Should not include filesystem in readiness check
      expect(readinessStatus.services).not.toHaveProperty('filesystem');
    });

    it('should return ready true when all critical services are up', async () => {
      const readinessStatus = await healthService.checkReadiness();
      
      const allCriticalServicesUp = Object.values(readinessStatus.services)
        .every(service => service.status === 'up');
      
      expect(readinessStatus.ready).toBe(allCriticalServicesUp);
    });
  });

  describe('service response times', () => {
    it('should include response times for up services', async () => {
      const readinessStatus = await healthService.checkReadiness();
      
      Object.values(readinessStatus.services).forEach((service: IServiceHealth) => {
        expect(service).toHaveProperty('status');
        expect(service).toHaveProperty('responseTime');
        expect(typeof service.responseTime).toBe('number');
        expect(service.responseTime).toBeGreaterThan(0);
      });
    });
  });
});
