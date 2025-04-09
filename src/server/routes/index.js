import express from 'express';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { logger, perfLogger } from '../utils/logger.js';

export function setupRoutes(app, { mcpManager, gitIngestManager }) {
  const router = express.Router();

  // Configure rate limiting
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: 'Too many requests, please try again later.'
    }
  });

  // Apply rate limiting to all routes
  router.use(apiLimiter);

  // Add request ID middleware for tracking
  router.use((req, res, next) => {
    req.id = uuidv4();
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  // Error handling middleware
  const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next))
      .catch(error => {
        logger.error('Route error:', {
          error: error.message,
          stack: error.stack,
          path: req.path,
          method: req.method,
          requestId: req.id
        });
        
        sendErrorResponse(res, 500, error.message || 'An unknown error occurred', req.id);
      });
  };

  // ===== Helper functions =====

  // Validate request fields
  const validateRequest = (req, res, validations) => {
    for (const [field, message] of Object.entries(validations)) {
      const value = req.body[field];
      if (!value || (typeof value === 'string' && value.trim().length === 0)) {
        sendErrorResponse(res, 400, message, req.id);
        return false;
      }
    }
    return true;
  };

  // Send standardized error response
  const sendErrorResponse = (res, status, message, requestId) => {
    return res.status(status).json({
      success: false,
      error: message,
      requestId
    });
  };

  // Send standardized success response
  const sendSuccessResponse = (res, data, requestId) => {
    return res.json({
      success: true,
      ...data,
      requestId,
      timing: {
        processedAt: new Date().toISOString()
      }
    });
  };

  // Log and measure performance of operations
  const processWithTiming = async (operationName, req, operation) => {
    const logPrefix = `${operationName}-${req.id}`;
    logger.info(`Starting ${operationName}`, { requestId: req.id });
    perfLogger.start(logPrefix);
    
    const result = await operation();
    
    perfLogger.end(logPrefix);
    return result;
  };

  // ===== Route handlers =====

  // Process repository and generate documentation
  router.post('/process', asyncHandler(async (req, res) => {
    const { repoUrl, isLocal = false, model } = req.body;
    
    if (!validateRequest(req, res, { repoUrl: 'Repository URL is required' })) return;
    
    logger.info(`Processing repository`, {
      repoUrl, isLocal, model: model || 'default', requestId: req.id
    });
    
    // Process with timing measurement
    const result = await processWithTiming('process-repo', req, async () => {
      // Process repository with GITINGEST
      const { structure, history, repoId, normalizedPath } = await gitIngestManager.processRepository(repoUrl, isLocal);
      
      if (!structure || structure.length === 0) {
        logger.error('Failed to process repository: No structure data returned', { requestId: req.id });
        throw new Error('Failed to process repository: No valid files found');
      }
      
      logger.info(`Repository processed`, { 
        fileCount: structure.length, repoId, requestId: req.id 
      });
      
      // Use MCPManager for documentation generation
      const documentation = await mcpManager.processWithContext(structure, {
        history, sourcePath: normalizedPath, isLocal, model, requestId: req.id
      });
      
      return { documentation, repoId };
    });
    
    return sendSuccessResponse(res, result, req.id);
  }));

  // Process file contents and generate documentation
  router.post('/process-content', asyncHandler(async (req, res) => {
    const { files, context = {} } = req.body;
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return sendErrorResponse(res, 400, 'Valid files array is required', req.id);
    }

    // Process with timing measurement
    const result = await processWithTiming('process-content', req, async () => {
      // Add request ID to context
      const enrichedContext = { ...context, requestId: req.id };
      const documentation = await mcpManager.processWithContext(files, enrichedContext);
      return { documentation };
    });
    
    return sendSuccessResponse(res, result, req.id);
  }));

  // Process single code snippet
  router.post('/process-code', asyncHandler(async (req, res) => {
    const { code, language, path, context = {} } = req.body;
    
    if (!validateRequest(req, res, {
      code: 'Code is required',
      language: 'Language is required'
    })) return;

    logger.info(`Processing code snippet`, { 
      language, path: path || 'unnamed', codeLength: code?.length, requestId: req.id 
    });
    
    // Process with timing measurement
    const result = await processWithTiming('process-code', req, async () => {
      try {
        // Ensure API key is set
        if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'your_openrouter_key_here') {
          return { 
            success: false,
            error: "API key not configured. Please set OPENROUTER_API_KEY environment variable."
          };
        }
        
        // Create a file-like structure for the MCPManager
        // Ensure the path has a valid extension based on the language
        const getExtensionForLanguage = (lang) => {
          const extensionMap = {
            javascript: '.js',
            typescript: '.ts',
            python: '.py',
            java: '.java',
            cpp: '.cpp',
            go: '.go',
            ruby: '.rb',
            php: '.php',
            html: '.html',
            css: '.css',
            shell: '.sh',
            json: '.json',
            markdown: '.md'
          };
          
          return extensionMap[lang.toLowerCase()] || `.${lang.toLowerCase()}`;
        };
        
        // Construct a path with proper extension if one is not provided
        let filePath = path;
        if (!path || !path.includes('.')) {
          const extension = getExtensionForLanguage(language);
          filePath = `snippet${extension}`;
        }
        
        const fileData = [{
          path: filePath,
          content: code,
          language
        }];

        // Add request ID to context
        const enrichedContext = { ...context, requestId: req.id };
        const documentation = await mcpManager.processWithContext(fileData, enrichedContext);
        return { documentation };
      } catch (error) {
        logger.error('Error processing code', { error: error.message, stack: error.stack });
        return { 
          success: false, 
          error: error.message || "An unexpected error occurred"
        };
      }
    });
    
    return sendSuccessResponse(res, result, req.id);
  }));

  // MCP direct endpoint for advanced use cases
  router.post('/mcp', asyncHandler(async (req, res) => {
    const { method, params } = req.body;
    
    if (!validateRequest(req, res, {
      method: 'Method is required',
      params: 'Parameters are required'
    })) return;

    logger.info(`MCP direct call`, { method, requestId: req.id });
    
    // This endpoint is not fully supported yet, but we'll keep it for future expansion
    return sendErrorResponse(res, 501, 'MCP direct endpoint not fully implemented', req.id);
  }));

  // Get documentation status
  router.get('/status/:repoId', asyncHandler(async (req, res) => {
    const { repoId } = req.params;
    
    if (!repoId) {
      return sendErrorResponse(res, 400, 'Repository ID is required', req.id);
    }
    
    // In the future, implement actual status checking
    // For now, return a placeholder
    return sendSuccessResponse(res, { status: 'processing', repoId }, req.id);
  }));

  // Health check endpoint
  router.get('/health', (req, res) => {
    return sendSuccessResponse(res, { 
      status: 'healthy',
      version: process.env.npm_package_version || '1.0.0'
    }, req.id);
  });

  // Test endpoints for Docker testing (both GET and POST)
  router.get('/test', (req, res) => {
    return sendSuccessResponse(res, {
      method: 'GET',
      message: 'DocuGenius API is working correctly',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    }, req.id);
  });
  
  router.post('/test', (req, res) => {
    // Echo back any JSON data that was sent
    return sendSuccessResponse(res, {
      method: 'POST',
      message: 'DocuGenius API is working correctly',
      receivedData: req.body,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    }, req.id);
  });

  // Register the router with the app
  app.use('/api', router);
}
