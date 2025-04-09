# MCP Server (src/server/mcp-server.js)

## Purpose & Overview

The MCP server (`mcp-server.js`) is the core component of DocuGenius that implements the Model Context Protocol (MCP). It's responsible for:

- Defining and registering documentation generation tools 
- Configuring MCP server capabilities
- Handling tool execution and error handling
- Managing connections with MCP clients

This file serves as the main entry point when running DocuGenius as an MCP server using `npm start`.

## Key Components

### Server Configuration

```javascript
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
```

This creates an MCP server instance with specific capabilities, indicating that it provides tools and prompts but doesn't handle resources or authentication.

### Tool: generate_documentation

This tool processes an array of files and generates comprehensive documentation:

```javascript
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
    // Implementation...
  }
);
```

#### Parameters:
- `content`: Array of file objects containing path, content, and optional language
- `context`: Optional context object with additional information

#### Returns:
- Text content representing the generated documentation

### Tool: generate_code_documentation

This tool processes a single code snippet and generates documentation for it:

```javascript
server.tool(
  "generate_code_documentation",
  {
    code: z.string(),
    language: z.string(),
    path: z.string().optional(),
    context: z.object({}).optional()
  },
  async ({ code, language, path = 'code_snippet', context = {} }) => {
    // Implementation...
  }
);
```

#### Parameters:
- `code`: The code snippet to document
- `language`: The programming language of the code
- `path`: Optional path/filename for the code
- `context`: Optional context object with additional information

#### Returns:
- Text content representing the generated documentation

### Prompt: document_code

The server defines a prompt template for code documentation:

```javascript
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
```

## Dependencies

- `@modelcontextprotocol/sdk`: Provides the MCP server implementation
- `zod`: Used for schema validation of tool inputs
- `MCPManager`: Internal service for processing documentation requests
- `GitIngestManager`: Internal service for repository management
- `logger`: Internal utility for logging
- `dotenv`: For loading environment variables

## Error Handling

The file implements comprehensive error handling:

```javascript
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection:', error);
  process.exit(1);
});
```

These handlers ensure that any unhandled errors are properly logged before the process terminates.

## Usage Examples

### Starting the MCP Server

```javascript
// From package.json scripts
"scripts": {
  "start": "node src/server/mcp-server.js"
}
```

### Connecting to the MCP Server

```javascript
// Using the Model Context Protocol SDK client
import { McpClient } from "@modelcontextprotocol/sdk/client";

const client = new McpClient();
await client.connect();

// Generating documentation
const result = await client.runTool("generate_documentation", {
  content: [
    { path: "file.js", content: "// JavaScript code", language: "javascript" }
  ]
});

console.log(result);
```

## Notes & Limitations

- The MCP server uses stdio for transport communication.
- The server requires an OpenRouter API key to be set in the environment variables.
- Error handling is implemented to ensure graceful termination in case of failures.
- The server doesn't implement authentication, so it should be used in trusted environments. 