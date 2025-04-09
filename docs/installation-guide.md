# Installation Guide

## Prerequisites

- Node.js (version 18 or later)
- npm (version 6 or later)
- Git (for repository processing)
- Docker and Docker Compose (optional, for containerized deployment)

## API Keys

DocuGenius requires an [OpenRouter API key](https://openrouter.ai/) to function. The application uses the OpenRouter API to access AI models for documentation generation.

1. Sign up for an account at [OpenRouter](https://openrouter.ai/)
2. Create a new API key 
3. Add the API key to your `.env` file

## Option 1: Local Setup

1. Clone the repository:
```bash
git clone https://github.com/Akshay-Sisodia/DocuGenius.git
cd docugenius
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

5. Start the server:
```bash
npm start
```

## Option 2: Docker Setup

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

After setting up DocuGenius, verify that everything is working correctly:

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

2. Check that the server is running by accessing the health endpoint:
```
http://localhost:3000/api/health
```

3. Process a sample code snippet to generate documentation:
```bash
curl -X POST http://localhost:3000/api/process-code \
  -H "Content-Type: application/json" \
  -d '{"code": "function hello() { return \"world\"; }", "language": "javascript"}'
``` 