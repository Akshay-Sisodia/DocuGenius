import request from 'supertest';
import express from 'express';
import { setupRoutes } from '../routes/index.js';
import { MCPManager } from '../services/mcp/index.js';
import { GitIngestManager } from '../services/gitingest/index.js';

describe('API Routes', () => {
  let app;
  let mcpManager;
  let gitIngestManager;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Create mock services
    mcpManager = {
      processWithContext: jest.fn()
    };
    
    gitIngestManager = {
      processRepository: jest.fn()
    };

    // Setup routes with mock services
    setupRoutes(app, { mcpManager, gitIngestManager });
  });

  describe('POST /api/process', () => {
    it('should return 400 if repoUrl is missing', async () => {
      const response = await request(app)
        .post('/api/process')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Repository URL is required');
    });

    it('should process repository and return documentation', async () => {
      const mockRepoData = {
        structure: ['file1', 'file2'],
        history: ['commit1', 'commit2'],
        repoId: '123'
      };

      const mockDocumentation = {
        content: 'Generated documentation'
      };

      gitIngestManager.processRepository.mockResolvedValue(mockRepoData);
      mcpManager.processWithContext.mockResolvedValue(mockDocumentation);

      const response = await request(app)
        .post('/api/process')
        .send({
          repoUrl: 'https://github.com/test/repo',
          isLocal: false
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.documentation).toEqual(mockDocumentation);
      expect(response.body.repoId).toBe('123');
    });

    it('should handle errors during processing', async () => {
      gitIngestManager.processRepository.mockRejectedValue(new Error('Processing failed'));

      const response = await request(app)
        .post('/api/process')
        .send({
          repoUrl: 'https://github.com/test/repo'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Processing failed');
    });
  });

  describe('GET /api/status/:repoId', () => {
    it('should return processing status', async () => {
      const response = await request(app)
        .get('/api/status/123');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('processing');
    });
  });

  describe('GET /api/health', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });
  });
}); 