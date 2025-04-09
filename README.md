# DocuGenius - AI Documentation Generator

DocuGenius is a powerful tool that uses advanced AI to automatically generate comprehensive documentation from your code. It supports both GitHub repositories and individual code snippets, making it versatile for various documentation needs.

## Features

- **GitHub Repository Processing**: Generate documentation for entire GitHub repositories
- **Code Snippet Documentation**: Document individual code snippets with support for multiple programming languages
- **Modern Web Interface**: Built with Streamlit for a clean and intuitive user experience
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
│   ├── client/         # Frontend client code
│   └── server/         # Backend server implementation
│       ├── routes/     # API route handlers
│       ├── services/   # Business logic services
│       ├── utils/      # Utility functions
│       └── index.js    # Main server entry point
├── ui.py              # Streamlit UI implementation
├── requirements.txt   # Python dependencies
├── package.json       # Node.js dependencies
└── .env.example       # Example environment configuration
```

## Setup

### Option 1: Local Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Create your environment configuration:
```bash
cp .env.example .env
```

4. Edit the `.env` file and add your OpenRouter API key:
```
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=nvidia/llama-3.1-nemotron-nano-8b-v1:free
```

### Option 2: Docker Setup (Backend Only)

1. Make sure you have Docker and Docker Compose installed.

2. Create your environment configuration:
```bash
cp .env.example .env
```

3. Update the necessary API keys in the `.env` file:
```
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

4. Build and run the backend using Docker Compose:
```bash
docker-compose up -d
```

5. The API will be available at http://localhost:3000/api.

6. To use with the Streamlit UI, run it locally:
```bash
pip install -r requirements.txt
streamlit run ui.py
```

7. To stop the Docker containers:
```bash
docker-compose down
```

8. To view logs:
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

1. Start the backend server:
```bash
npm start
```

2. Start the Streamlit UI:
```bash
streamlit run ui.py
```

3. Open your browser and navigate to the provided URL (typically http://localhost:8501)

## Using the Application

### GitHub Repository Documentation
1. Select the "GitHub Repository" tab
2. Enter the GitHub repository URL
3. Click "Generate Documentation"
4. Wait for the process to complete
5. View or download the generated documentation

### Code Snippet Documentation
1. Select the "Code Snippet" tab
2. Paste your code in the text area
3. Select the programming language
4. (Optional) Provide a file path
5. Click "Generate Documentation"
6. View or download the generated documentation

## API Endpoints

- `POST /api/process`: Process GitHub repositories
- `POST /api/process-code`: Process code snippets
- `GET /api/health`: API health check endpoint

## Troubleshooting

### API Key Issues

If you encounter API errors or "Invalid API response structure" errors:

1. Verify your OpenRouter API key in the `.env` file
2. Check for rate limits - OpenRouter has usage limits for free accounts
3. Try a different model by updating `OPENROUTER_MODEL` in your `.env`

### Request Issues

For detailed error information, check the logs in the `logs` directory:
```bash
cat ./logs/combined.log
cat ./logs/error.log
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Add your license information here] 