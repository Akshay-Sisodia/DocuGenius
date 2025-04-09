import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MCPManager } from './services/mcp/index.js';
import { GitIngestManager } from './services/gitingest/index.js';
import { logger } from './utils/logger.js';
import { config } from 'dotenv';

// Load environment variables
config();

// Initialize services
const mcpManager = new MCPManager();
const gitIngestManager = new GitIngestManager();

logger.info('Starting DocuGenius MCP server...');

// Create MCP server with capabilities
const server = new McpServer({
  name: "docugenius",
  version: "1.0.0",
  description: "AI-powered documentation generator",
  capabilities: {
    tools: true,
    prompts: true,
    resources: false,
    authentication: false
  }
});

// Define tools
server.tool(
  "generate_documentation",
  {
    content: z.array(z.object({
      path: z.string(),
      content: z.string(),
      language: z.string().optional()
    })),
    context: z.object({}).optional()
  },
  async ({ content, context = {} }) => {
    try {
      logger.info('Generating documentation for content:', { 
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
      logger.error('Error generating documentation:', error);
      return {
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

server.tool(
  "generate_code_documentation",
  {
    code: z.string(),
    language: z.string(),
    path: z.string().optional(),
    context: z.object({}).optional()
  },
  async ({ code, language, path = 'code_snippet', context = {} }) => {
    try {
      logger.info('Generating code documentation:', {
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
      logger.error('Error generating code documentation:', error);
      return {
        content: [{
          type: "text",
          text: `Error: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// Define prompts for documentation generation
server.prompt(
  "document_code",
  {
    code: z.string(),
    language: z.string(),
    context: z.object({}).optional()
  },
  ({ code, language, context = {} }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please document this ${language} code:\n\n${code}\n\nContext: ${JSON.stringify(context)}`
      }
    }]
  })
);

// Start the server with stdio transport
const transport = new StdioServerTransport();

// Handle initialization
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection:', error);
  process.exit(1);
});

// Connect to transport
try {
  logger.info('Connecting to transport...');
  await server.connect(transport);
  logger.info('DocuGenius MCP server started successfully');
} catch (error) {
  logger.error('Failed to start MCP server:', error);
  process.exit(1);
} 