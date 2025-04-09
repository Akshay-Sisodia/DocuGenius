# Installation and Setup

## Prerequisites

- Node.js (version 14 or later)
- npm (version 6 or later)
- Git (for repository processing)

## Installation Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/docugenius.git
   cd docugenius
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on the provided example:
   ```bash
   cp .env.example .env
   ```

4. Obtain an OpenRouter API key and update your `.env` file:
   ```
   OPENROUTER_API_KEY=your_openrouter_api_key_here
   ```

## Running the Application

### Development Mode

```bash
npm run dev
```

This will start the Express server on port 3000 (or the port specified in your `.env` file).

### Production Mode

```bash
npm start
```

This will start the MCP server for integration with external tools.

## Environment Configuration

See the [Configuration Guide](./configuration.md) for detailed information about environment variables.

## Verifying Installation

To verify that the installation was successful, you can:

1. Check that the server is running by accessing the health endpoint:
   ```
   http://localhost:3000/api/health
   ```

2. Process a sample repository to generate documentation:
   ```bash
   curl -X POST http://localhost:3000/api/process \
     -H "Content-Type: application/json" \
     -d '{"repoUrl": "https://github.com/example/repo.git"}'
   ``` 