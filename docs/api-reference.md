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

#### Example Request

```json
{
  "repoUrl": "https://github.com/example/repo.git",
  "isLocal": false
}
```

#### Example Response

```json
{
  "success": true,
  "documentation": "# Generated Documentation\n\n...",
  "repoId": "example-repo-12345"
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
  "documentation": "# Generated Documentation\n\n..."
}
```

### Check Status

```
GET /api/status/:repoId
```

Check the status of a documentation generation request.

#### Parameters

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| repoId | string | ID of the repository | Yes |

#### Example Response

```json
{
  "status": "processing"
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
  "status": "healthy"
}
```

## MCP Tools

DocuGenius also exposes tools for the Model Context Protocol (MCP):

### Generate Documentation

Generates documentation for the provided content.

#### Parameters

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| content | array | Array of file objects | Yes |
| context | object | Additional context | No |

### Generate Code Documentation

Generates documentation for specific code snippets.

#### Parameters

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| code | string | Code to document | Yes |
| language | string | Language of the code | Yes |
| path | string | Path of the file | No |
| context | object | Additional context | No | 