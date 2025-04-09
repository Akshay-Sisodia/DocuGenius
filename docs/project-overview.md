# DocuGenius - AI Documentation Generator

DocuGenius is a powerful tool that uses advanced AI to automatically generate comprehensive documentation from your code. It serves as a Machine Coding Protocol (MCP) server that integrates with development environments to provide documentation generation services.

## Architecture

DocuGenius consists of the following core components:

1. **MCP Server**: Handles documentation generation requests and communicates with AI models.
2. **Git Ingestion Service**: Clones and analyzes Git repositories, extracting file content for documentation.
3. **Express API Server**: Provides RESTful API endpoints for processing repositories and generating documentation.

## Key Features

- **GitHub Repository Processing**: Generate documentation for entire GitHub repositories
- **Code Snippet Documentation**: Document individual code snippets with support for multiple programming languages
- **MCP Integration**: Easy integration with development environments like Cursor
- **Markdown Output**: Generated documentation in markdown format for easy integration with existing documentation systems
- **Multiple Language Support**: JavaScript, TypeScript, Python, Java, C++, Go, Ruby, PHP, HTML, CSS, Shell, JSON, Markdown

## Technology Stack

- Node.js
- Express.js
- OpenRouter API (for AI model access)
- Simple Git (for repository management)
- Winston (for logging)
- Zod (for schema validation)
- Docker (for containerization)

## Project Structure

```
docugenius/
├── src/
│   └── server/         # Backend server implementation
│       ├── routes/     # API route handlers
│       ├── services/   # Business logic services
│       │   ├── mcp/    # MCP service for documentation generation
│       │   ├── gitingest/ # Git repository ingestion service
│       │   └── dbOps/  # Database operations
│       ├── utils/      # Utility functions
│       └── index.js    # Main server entry point
├── docs/              # Documentation files
├── package.json       # Node.js dependencies
├── docker-compose.yml # Docker configuration
├── Dockerfile         # Docker build instructions
└── .env.example       # Example environment configuration
``` 