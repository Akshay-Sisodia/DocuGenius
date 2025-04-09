# API Reference

DocuGenius exposes a RESTful API for interacting with the documentation generation services.

## Endpoints

### Process Repository

```
POST /api/process
```

Generate documentation for a Git repository.

#### Request Body

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| repoUrl | string | URL or path to the repository | Yes |
| isLocal | boolean | Whether the repository is local | No (default: false) |
| model | string | Model to use for documentation generation | No |

#### Example Request

```json
{
  "repoUrl": "https://github.com/Akshay-Sisodia/DocuGenius.git",
  "isLocal": false
}
```

#### Example Response

```json
{
  "success": true,
  "documentation": "# Generated Documentation\n\n...",
  "repoId": "example-repo-12345",
  "requestId": "uuid-v4",
  "timing": {
    "processedAt": "2023-04-09T16:30:00.000Z"
  }
}
```

### Process Content

```
POST /api/process-content
```

Generate documentation for file contents directly.

#### Request Body

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| files | array | Array of file objects | Yes |
| context | object | Additional context for processing | No (default: {}) |

Each file object should have:

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| path | string | Path of the file | Yes |
| content | string | Content of the file | Yes |
| language | string | Language of the file | No |

#### Example Request

```json
{
  "files": [
    {
      "path": "main.js",
      "content": "function hello() { return 'world'; }",
      "language": "javascript"
    }
  ],
  "context": {
    "projectName": "Example Project"
  }
}
```

#### Example Response

```json
{
  "success": true,
  "documentation": "# Generated Documentation\n\n...",
  "requestId": "uuid-v4",
  "timing": {
    "processedAt": "2023-04-09T16:30:00.000Z"
  }
}
```

### Process Code

```
POST /api/process-code
```

Generate documentation for a single code snippet.

#### Request Body

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| code | string | Code to document | Yes |
| language | string | Language of the code | Yes |
| path | string | Path of the file | No |
| context | object | Additional context | No |

#### Example Request

```json
{
  "code": "function hello() { return 'world'; }",
  "language": "javascript",
  "path": "main.js"
}
```

#### Example Response

```json
{
  "success": true,
  "documentation": "# Generated Documentation\n\n...",
  "requestId": "uuid-v4",
  "timing": {
    "processedAt": "2023-04-09T16:30:00.000Z"
  }
}
```

### Health Check

```
GET /api/health
```

Check the health status of the API.

#### Example Response

```json
{
  "status": "healthy",
  "uptime": 3600,
  "memory": {
    "total": "1024MB",
    "used": "512MB",
    "free": "512MB"
  },
  "version": "1.0.0"
}
```

## MCP Tools

DocuGenius also exposes tools for the Model Context Protocol (MCP):

### Generate Documentation

```
mcp_docugenius_generate_documentation
```

Generates documentation for the provided content.

#### Parameters

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| content | array | Array of file objects | Yes |
| context | object | Additional context | No |

Each file object in the content array should contain:

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| path | string | Path of the file | Yes |
| content | string | Content of the file | Yes |
| language | string | Language of the file | No |

### Generate Code Documentation

```
mcp_docugenius_generate_code_documentation
```

Generates documentation for specific code snippets.

#### Parameters

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| code | string | Code to document | Yes |
| language | string | Language of the code | Yes |
| path | string | Path of the file | No |
| context | object | Additional context | No | 