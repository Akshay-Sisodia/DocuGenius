# DocuGenius - AI Documentation Generator MCP

DocuGenius is a powerful tool that uses advanced AI to automatically generate comprehensive documentation from your code. It's designed as a Machine Coding Protocol (MCP) server that integrates with development environments to provide documentation generation services.

## Features

- **GitHub Repository Processing**: Generate documentation for entire GitHub repositories
- **Code Snippet Documentation**: Document individual code snippets with support for multiple programming languages
- **MCP Integration**: Easy integration with development environments like Cursor
- **Markdown Output**: Generated documentation in markdown format for easy integration with existing documentation systems
- **Multiple Language Support**: Supports documentation generation for:
  - JavaScript
  - TypeScript
  - Python
  - Java
  - C++
  - Go
  - Ruby
  - PHP
  - HTML
  - CSS
  - Shell
  - JSON
  - Markdown

## Requirements

### API Keys

DocuGenius requires an [OpenRouter API key](https://openrouter.ai/) to function. The application uses the OpenRouter API to access AI models for documentation generation.

1. Sign up for an account at [OpenRouter](https://openrouter.ai/)
2. Create a new API key 
3. Add the API key to your `.env` file (see Setup below)

## Project Structure

```
docugenius/
├── src/
│   └── server/         # Backend server implementation
│       ├── routes/     # API route handlers
│       ├── services/   # Business logic services
│       ├── utils/      # Utility functions
│       └── index.js    # Main server entry point
├── package.json       # Node.js dependencies
└── .env.example       # Example environment configuration
```

## Setup

### Option 1: Local Setup

1. Install Node.js dependencies:
```bash
npm install
```

2. Create your environment configuration:
```bash
cp .env.example .env
```

3. Edit the `.env` file and add your OpenRouter API key:
```
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=nvidia/llama-3.1-nemotron-nano-8b-v1:free
```

### Option 2: Docker Setup

1. Make sure you have Docker and Docker Compose installed.

2. Create your environment configuration:
```bash
cp .env.example .env
```

3. Update the necessary API keys in the `.env` file:
```
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

4. Build and run using Docker Compose:
```bash
docker-compose up -d
```

5. The API will be available at http://localhost:3000/api.

6. To stop the Docker containers:
```bash
docker-compose down
```

7. To view logs:
```bash
docker-compose logs -f
```

## Verifying Your Setup

After setting up DocuGenius, you should verify that everything is working correctly:

1. Test your OpenRouter API key:
```bash
# Create a test file to verify the API key
cat > test-api.js << EOF
import { config } from 'dotenv';
import OpenAI from 'openai';

config();
const apiKey = process.env.OPENROUTER_API_KEY;
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: apiKey,
});

async function testAPI() {
  try {
    const completion = await openai.chat.completions.create({
      model: 'nvidia/llama-3.1-nemotron-nano-8b-v1:free',
      messages: [{ role: 'user', content: 'Hello world' }]
    });
    console.log('API test successful!', completion.choices[0].message.content);
  } catch (error) {
    console.error('API test failed:', error.message);
  }
}

testAPI();
EOF

# Run the test
node test-api.js
```

2. Test the API server:
```bash
curl http://localhost:3000/api/health
```

You should see a success response.

## Usage

1. Start the MCP server:
```bash
npm start
```

2. The server will be available at http://localhost:3000

## Using with Cursor IDE

To integrate DocuGenius with Cursor IDE:

1. Configure your Cursor to use this MCP server endpoint
2. Use the documentation generation commands through Cursor's interface
3. Access generated documentation directly in your development environment

## API Endpoints

- `POST /api/process`: Process GitHub repositories
- `POST /api/process-code`: Process code snippets
- `GET /api/health`: API health check endpoint
- `POST /mcp/docugenius/generate-documentation`: Generate documentation through MCP protocol
- `POST /mcp/docugenius/generate-code-documentation`: Generate documentation for specific code through MCP protocol

## Troubleshooting

### API Key Issues

If you encounter API errors or "Invalid API response structure" errors:

1. Verify your OpenRouter API key in the `.env` file
2. Check for rate limits - OpenRouter has usage limits for free accounts
3. Try a different model by updating `OPENROUTER_MODEL` in your `.env`

### MCP Integration Issues

If you encounter issues with MCP integration:

1. Verify your MCP server is running and accessible
2. Check your IDE's MCP configuration
3. Ensure proper permissions for your MCP server

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 