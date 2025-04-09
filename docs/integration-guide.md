# Integration Guide

## Integrating with Development Environments

DocuGenius is designed to integrate with various development environments through its API and MCP protocol.

### Cursor IDE Integration

DocuGenius works natively with Cursor IDE through the MCP protocol:

1. In Cursor IDE, access the settings menu
2. Navigate to the Model Context Protocol (MCP) section
3. Add a new MCP server with URL `http://localhost:3000`
4. Verify connection by using the documentation generation command

Once connected, you can generate documentation directly within Cursor using the provided MCP commands.

### GitHub Integration

You can integrate DocuGenius with GitHub workflows:

1. Create a GitHub Actions workflow file (`.github/workflows/generate-docs.yml`)
2. Configure the workflow to call DocuGenius API endpoints
3. Store generated documentation in your repository

Example workflow:

```yaml
name: Generate Documentation
on:
  push:
    branches: [ main ]
paths:
  - '**.js'
  - '**.ts'
  - '**.py'
jobs:
  document:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Generate Docs
        run: |
          curl -X POST https://your-docugenius-instance.com/api/process \
            -H "Content-Type: application/json" \
            -d '{"repoUrl": "https://github.com/Akshay-Sisodia/DocuGenius", "isLocal": false}' \
            > docs/generated.md
      - name: Commit Docs
        uses: EndBug/add-and-commit@v9
        with:
          add: 'docs/generated.md'
          message: 'Update documentation'
```

### CI/CD Pipeline Integration

Integrate DocuGenius into your CI/CD pipelines to automatically generate documentation when code changes:

1. Deploy DocuGenius as a service in your infrastructure
2. Add a documentation generation step to your CI/CD pipeline
3. Configure webhooks to trigger documentation updates

Example Jenkins pipeline step:

```groovy
stage('Generate Documentation') {
  steps {
    sh '''
      curl -X POST http://docugenius-service:3000/api/process \
        -H "Content-Type: application/json" \
        -d '{"repoUrl": "https://github.com/Akshay-Sisodia/DocuGenius", "isLocal": false}' \
        > docs/generated.md
    '''
    archiveArtifacts artifacts: 'docs/generated.md', fingerprint: true
  }
}
```

### Custom Integration

For custom integrations, use the DocuGenius API endpoints:

1. Make HTTP requests to the appropriate endpoints
2. Process the documentation responses in your application
3. Display or store the documentation as needed

Example Node.js integration:

```javascript
const fetch = require('node-fetch');

async function generateDocumentation(codeSnippet, language) {
  const response = await fetch('http://localhost:3000/api/process-code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code: codeSnippet,
      language: language
    }),
  });
  
  const result = await response.json();
  
  if (result.success) {
    return result.documentation;
  } else {
    throw new Error(result.error || 'Documentation generation failed');
  }
}
```

## API Authentication

When exposing DocuGenius to external services, consider adding authentication:

1. Implement API key validation
2. Add the auth middleware to the Express routes
3. Require API keys for all requests

Example implementation:

```javascript
// Add to your routes file
const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }
  next();
};

// Apply to routes
router.use(apiKeyMiddleware);
```

## Extending DocuGenius

DocuGenius can be extended with additional capabilities:

1. Add new MCP tools for specific documentation needs
2. Implement additional language support
3. Create custom output formats beyond Markdown
4. Add integration with documentation hosting services

To add a new MCP tool, extend the `registerMcpTools` function in `src/server/index.js`:

```javascript
// Example: Add a new MCP tool for generating API documentation
mcpServer.tool(
  "generate_api_documentation",
  {
    code: z.string(),
    language: z.string(),
    context: contextSchema
  },
  async ({ code, language, context = {} }) => {
    try {
      // Implement your custom logic here
      const result = await mcpManager.processApiDocs(code, language, context);
      
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
``` 