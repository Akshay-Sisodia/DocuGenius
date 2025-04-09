# Usage Guide

## Using DocuGenius API

The DocuGenius API provides several ways to generate documentation for your code.

### Documenting a GitHub Repository

1. Make a POST request to `/api/process` with the repository URL:

```bash
curl -X POST http://localhost:3000/api/process \
  -H "Content-Type: application/json" \
  -d '{"repoUrl": "https://github.com/Akshay-Sisodia/DocuGenius.git"}'
```

2. The API will clone the repository, analyze its contents, and generate documentation.

### Documenting Code Snippets

For individual code snippets, use the `/api/process-code` endpoint:

```bash
curl -X POST http://localhost:3000/api/process-code \
  -H "Content-Type: application/json" \
  -d '{"code": "function sum(a, b) { return a + b; }", "language": "javascript"}'
```

### Documenting Multiple Files

For multiple files, use the `/api/process-content` endpoint:

```bash
curl -X POST http://localhost:3000/api/process-content \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {
        "path": "math.js",
        "content": "function sum(a, b) { return a + b; }",
        "language": "javascript"
      },
      {
        "path": "utils.py",
        "content": "def greet(name):\\n    return f\\\"Hello, {name}!\\\"",
        "language": "python"
      }
    ]
  }'
```

## Using with Cursor IDE

DocuGenius is designed to integrate with Cursor IDE through the MCP protocol:

1. Open Cursor IDE settings
2. Navigate to the MCP section
3. Add DocuGenius as an MCP server with the URL `http://localhost:3000`
4. Use the documentation generation commands through Cursor's interface

## Documentation Format

The generated documentation follows a consistent format:

1. **Overview** - Brief description of the code's purpose
2. **Function/Class Documentation** - Details about each function or class
3. **Parameters** - Information about input parameters
4. **Return Values** - Description of what the code returns
5. **Dependencies** - List of dependencies and imports
6. **Examples** - Usage examples where appropriate

## Best Practices

1. **Provide Context** - When generating documentation for code snippets, provide meaningful file paths and context information
2. **Choose the Right Model** - Different models have different capabilities and costs
3. **Batch Requests** - For large repositories, consider processing multiple smaller batches of files
4. **Integration** - Incorporate generated documentation into your existing documentation system

## Using the MCP Tools

If you're using tools that support the Model Context Protocol (MCP), you can use the following functions:

### mcp_docugenius_generate_documentation

This tool generates documentation for multiple files:

```javascript
// Example usage in an MCP-enabled environment
const result = await mcp_docugenius_generate_documentation({
  content: [
    {
      path: "main.js",
      content: "function hello() { return 'world'; }",
      language: "javascript"
    },
    {
      path: "utils.js",
      content: "function sum(a, b) { return a + b; }",
      language: "javascript"
    }
  ]
});
```

### mcp_docugenius_generate_code_documentation

This tool generates documentation for a single code snippet:

```javascript
// Example usage in an MCP-enabled environment
const result = await mcp_docugenius_generate_code_documentation({
  code: "function hello() { return 'world'; }",
  language: "javascript",
  path: "main.js"
});
``` 