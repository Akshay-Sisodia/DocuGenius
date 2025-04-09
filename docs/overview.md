# Project Overview

## What is DocuGenius?

DocuGenius is an AI-powered documentation generator that automates the creation of high-quality documentation for your projects. It uses advanced AI models to analyze your codebase and generate accurate, up-to-date documentation.

## Architecture

DocuGenius consists of the following core components:

### 1. MCP Server
The Model Context Protocol (MCP) server is responsible for handling documentation generation requests and communicating with AI models.

### 2. Git Ingestion Service
This service clones and analyzes Git repositories, extracting file content for documentation generation.

### 3. Express API Server
Provides RESTful API endpoints for processing repositories and generating documentation.

## Key Features

1. **Repository Documentation** - Generate comprehensive documentation for entire repositories
2. **Code Documentation** - Generate detailed documentation for specific code files
3. **Local & Remote Repository Support** - Process both local directories and remote Git repositories
4. **AI-Powered Analysis** - Leverage advanced AI models for intelligent content generation

## Technology Stack

- Node.js
- Express.js
- OpenRouter API (for AI model access)
- Simple Git (for repository management)
- Winston (for logging)
- Zod (for schema validation) 