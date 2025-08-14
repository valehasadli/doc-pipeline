import request from 'supertest';
import express from 'express';

import { createHealthRoutes } from '@health/presentation/routes';

describe('Health Endpoints', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/', createHealthRoutes());
  });

  describe('GET /health', () => {
    it('should return 200 and health status when all services are healthy', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('services');

      expect(['healthy', 'unhealthy']).toContain(response.body.status);
      expect(typeof response.body.timestamp).toBe('string');
      expect(typeof response.body.uptime).toBe('number');
      expect(typeof response.body.version).toBe('string');
      expect(typeof response.body.services).toBe('object');
    });

    it('should return valid ISO timestamp', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      const timestamp = response.body.timestamp;
      expect(() => new Date(timestamp)).not.toThrow();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('should include all required services in health check', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      const services = response.body.services;
      expect(services).toHaveProperty('mongodb');
      expect(services).toHaveProperty('redis');
      expect(services).toHaveProperty('filesystem');

      // Each service should have proper structure
      Object.values(services).forEach((service: unknown) => {
        expect(service).toHaveProperty('status');
        expect(service).toHaveProperty('status');
        if (typeof service === 'object' && service !== null && 'status' in service) {
          expect(['up', 'down']).toContain((service as { status: string }).status);
        }
      });
    });
  });

  describe('GET /ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/ready')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('ready');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');

      expect(typeof response.body.ready).toBe('boolean');
      expect(typeof response.body.timestamp).toBe('string');
      expect(typeof response.body.services).toBe('object');
    });

    it('should check only critical services for readiness', async () => {
      const response = await request(app)
        .get('/ready')
        .expect(200);

      const services = response.body.services;
      expect(services).toHaveProperty('mongodb');
      expect(services).toHaveProperty('redis');
      
      // Should not include filesystem in readiness check
      expect(services).not.toHaveProperty('filesystem');
    });

    it('should return valid ISO timestamp', async () => {
      const response = await request(app)
        .get('/ready')
        .expect(200);

      const timestamp = response.body.timestamp;
      expect(() => new Date(timestamp)).not.toThrow();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });
  });

  describe('GET /ping', () => {
    it('should return 200 and pong response', async () => {
      const response = await request(app)
        .get('/ping')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String),
        message: 'pong',
      });
    });

    it('should return valid ISO timestamp', async () => {
      const response = await request(app)
        .get('/ping')
        .expect(200);

      const timestamp = response.body.timestamp;
      expect(() => new Date(timestamp)).not.toThrow();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('should be fast (under 100ms)', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/ping')
        .expect(200);
        
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      // This test would be more meaningful with actual service failures
      // For now, we just ensure the endpoints don't crash
      const response = await request(app)
        .get('/health');

      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
