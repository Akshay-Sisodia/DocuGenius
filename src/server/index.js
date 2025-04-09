import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import helmet from 'helmet';
import { config } from 'dotenv';
import { setupRoutes } from './routes/index.js';
import { logger, debugLog, stream } from './utils/logger.js';
import { MCPManager } from './services/mcp/index.js';
import { GitIngestManager } from './services/gitingest/index.js';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import os from 'os';
import { fileURLToPath } from 'url';

// Configuration
const CONFIG = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_KEY_STATUS: process.env.OPENROUTER_API_KEY ? 'Set' : 'Not set',
  MODEL: process.env.OPENROUTER_MODEL || 'default',
  MCP_VERSION: '1.0.0',
  DEFAULT_REQ_TIMEOUT: 120000, // 2 minutes
  MEMORY_CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutes
  MAX_HEAP_SIZE_MB: process.env.MAX_HEAP_SIZE_MB || 1024 // 1GB default
};

// Initialize application
async function initializeApp() {
  // Load environment variables
  config();

  // Log startup info
  logger.info('Starting DocuGenius server', {
    environment: CONFIG.NODE_ENV,
    port: CONFIG.PORT,
    apiKeys: {
      openrouter: CONFIG.API_KEY_STATUS,
    },
    model: CONFIG.MODEL,
    memory: {
      total: Math.round(os.totalmem() / (1024 * 1024)) + 'MB',
      available: Math.round(os.freemem() / (1024 * 1024)) + 'MB'
    }
  });

  // Create Express application
  const app = express();

  // Apply middleware
  configureMiddleware(app);

  // Initialize services
  const services = await initializeServices();

  // Setup routes and error handlers
  setupRoutesAndErrorHandlers(app, services);

  // Monitor system resources
  setupResourceMonitoring();

  return { app, services };
}

// Configure all middleware
function configureMiddleware(app) {
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"]
      }
    }
  }));

  // Response compression - Put this early in middleware chain
  app.use(compression({
    level: 6, // Balanced compression level
    threshold: 1024 // Only compress responses larger than 1KB
  }));

  // Cross-origin resource sharing
  app.use(cors({
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID']
  }));

  // Body parsers with size limits
  app.use(express.json({ 
    limit: '50mb',
    strict: true // Reject payloads that are not valid JSON
  }));
  app.use(express.urlencoded({ 
    extended: true, 
    limit: '50mb',
    parameterLimit: 1000 // Limit number of parameters
  }));

  // Request timeout handler
  app.use((req, res, next) => {
    // Set request timeout
    req.setTimeout(CONFIG.DEFAULT_REQ_TIMEOUT, () => {
      res.status(408).json({ 
        success: false, 
        error: 'Request timeout'
      });
    });
    next();
  });

  // Add logging for development
  if (CONFIG.NODE_ENV !== 'production') {
    app.use(morgan('dev', { stream }));
  }
}

// Initialize all services
async function initializeServices() {
  try {
    // Initialize MCP Manager
    const mcpManager = new MCPManager();
    
    // Initialize Git Ingest Manager
    const gitIngestManager = new GitIngestManager();
    
    // Create MCP server with capabilities
    const mcpServer = createMcpServer(mcpManager);
    
    return { mcpManager, gitIngestManager, mcpServer };
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    throw new Error(`Service initialization failed: ${error.message}`);
  }
}

// Create and configure MCP server
function createMcpServer(mcpManager) {
  // Create MCP server with capabilities
  const mcpServer = new McpServer({
    name: "docugenius",
    version: CONFIG.MCP_VERSION,
    description: "AI-powered documentation generator",
    capabilities: {
      tools: true,
      prompts: true,
      resources: false,
      authentication: false
    }
  });

  // Register all MCP tools
  registerMcpTools(mcpServer, mcpManager);
  
  return mcpServer;
}

// Common error handler for MCP tools
function handleMcpToolError(error) {
  logger.error('Error in MCP tool:', error);
  return {
    content: [{
      type: "text",
      text: `Error: ${error.message}`
    }],
    isError: true
  };
}

// Register all MCP tools
function registerMcpTools(mcpServer, mcpManager) {
  // Define schema for file content
  const fileSchema = z.object({
    path: z.string(),
    content: z.string(),
    language: z.string().optional()
  });
  
  // Define schema for context
  const contextSchema = z.object({}).optional();
  
  // Generate documentation for content
  mcpServer.tool(
    "generate_documentation",
    {
      content: z.array(fileSchema),
      context: contextSchema
    },
    async ({ content, context = {} }) => {
      try {
        logger.info('Generating documentation for content via MCP tool', { 
          fileCount: content.length,
          contextKeys: Object.keys(context)
        });
        
        const result = await mcpManager.processWithContext(content, context);
        return {
          content: [{
            type: "text",
            text: result
          }]
        };
      } catch (error) {
        return handleMcpToolError(error);
      }
    }
  );

  // Generate documentation for code snippet
  mcpServer.tool(
    "generate_code_documentation",
    {
      code: z.string(),
      language: z.string(),
      path: z.string().optional(),
      context: contextSchema
    },
    async ({ code, language, path = 'code_snippet', context = {} }) => {
      try {
        logger.info('Generating code documentation via MCP tool', {
          language,
          path,
          codeLength: code.length,
          contextKeys: Object.keys(context)
        });
        
        const result = await mcpManager.processWithContext([{
          path,
          content: code,
          language
        }], context);
        
        return {
          content: [{
            type: "text",
            text: result
          }]
        };
      } catch (error) {
        return handleMcpToolError(error);
      }
    }
  );
}

// Setup routes and error handlers
function setupRoutesAndErrorHandlers(app, services) {
  // Setup routes
  setupRoutes(app, services);

  // Global error handling middleware
  app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    logger.error('Server error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    });
    
    res.status(statusCode).json({
      success: false,
      error: CONFIG.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : err.message || 'Something went wrong!'
    });
  });

  // 404 handler for undefined routes
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Resource not found'
    });
  });
}

// Setup resource monitoring
function setupResourceMonitoring() {
  // Check memory usage periodically
  setInterval(() => {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / (1024 * 1024));
    const heapTotalMB = Math.round(memoryUsage.heapTotal / (1024 * 1024));
    
    logger.debug('Memory usage:', {
      heapUsedMB,
      heapTotalMB,
      rss: Math.round(memoryUsage.rss / (1024 * 1024)) + 'MB',
      external: Math.round(memoryUsage.external / (1024 * 1024)) + 'MB'
    });
    
    // Check if memory usage exceeds threshold
    if (heapUsedMB > CONFIG.MAX_HEAP_SIZE_MB) {
      logger.warn(`Memory usage exceeds threshold: ${heapUsedMB}MB / ${CONFIG.MAX_HEAP_SIZE_MB}MB`);
      
      // Try to free memory
      global.gc && global.gc();
    }
  }, CONFIG.MEMORY_CHECK_INTERVAL);
}

// Start server
async function startServer() {
  try {
    const { app } = await initializeApp();
    
    const server = app.listen(CONFIG.PORT, () => {
      debugLog(`DocuGenius server running on port ${CONFIG.PORT}`);
    });
    
    // Graceful shutdown
    setupGracefulShutdown(server);
    
    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Setup graceful shutdown
function setupGracefulShutdown(server) {
  const gracefulShutdown = () => {
    debugLog('Received shutdown signal, closing server...');
    server.close(() => {
      debugLog('Server closed successfully');
      process.exit(0);
    });
    
    // Force close after timeout
    setTimeout(() => {
      logger.error('Forcing server shutdown after timeout');
      process.exit(1);
    }, 10000);
  };
  
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    gracefulShutdown();
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection:', { reason });
    gracefulShutdown();
  });
}

// Start server if this file is run directly
const currentFilePath = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === currentFilePath;

// Add more explicit console logging for Docker debugging
console.log(`Starting DocuGenius server from ${currentFilePath}`);
console.log(`Is main module: ${isMainModule}`);
console.log(`Process arguments: ${process.argv.join(', ')}`);

if (isMainModule) {
  console.log('Running as main module, starting server...');
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
} else {
  console.log('Not running as main module, skipping server start');
}

// Export for testing
export { initializeApp, startServer };
