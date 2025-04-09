# Configuration Guide

## Environment Variables

DocuGenius uses environment variables for configuration. Create a `.env` file in the root directory with the following variables:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| PORT | Port for the Express server | 3000 | No |
| NODE_ENV | Environment (development/production) | development | No |
| OPENROUTER_API_KEY | API key for OpenRouter | - | Yes |
| OPENROUTER_MODEL | Model to use for generation | nvidia/llama-3.1-nemotron-nano-8b-v1:free | No |
| GITHUB_TOKEN | GitHub token for accessing private repositories | - | No |
| LOG_LEVEL | Logging level | info | No |
| LOG_TO_CONSOLE | Whether to log to console | true | No |
| LOG_TO_FILE | Whether to log to file | true | No |
| LOG_FILE_PATH | Path to log file | ./logs/combined.log | No |
| ERROR_LOG_FILE_PATH | Path to error log file | ./logs/error.log | No |
| TEMP_DIR | Directory for temporary files | ./temp | No |
| ENABLE_ZERO_PERSISTENCE | Whether to enable zero persistence | false | No |
| MAX_REPO_SIZE_MB | Maximum repository size in MB | 100 | No |
| MAX_FILE_SIZE_KB | Maximum file size in KB | 500 | No |
| MAX_TOTAL_FILES | Maximum number of files to process | 100 | No |
| MAX_CONCURRENT_REQUESTS | Maximum number of concurrent requests | 3 | No |

## Docker Configuration

When using Docker, you can configure the application using the `.env-docker` file. The Docker setup includes:

- Node.js runtime environment
- Express server
- Proper port mapping
- Volume for logs persistence

The Docker Compose configuration can be found in `docker-compose.yml`:

```yaml
version: '3.8'
services:
  docugenius:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./logs:/app/logs
    env_file:
      - .env-docker
    restart: unless-stopped
```

## Logging Configuration

DocuGenius uses Winston for logging with the following features:

- Console logging for development
- File logging for production
- Daily log rotation
- Performance metrics logging
- Request ID tracking

You can configure logging behavior through the environment variables:

```
LOG_LEVEL=info
LOG_TO_CONSOLE=true
LOG_TO_FILE=true
LOG_FILE_PATH=./logs/combined.log
ERROR_LOG_FILE_PATH=./logs/error.log
```

## Security Configuration

The application includes several security measures:

- Helmet.js for secure HTTP headers
- Rate limiting for API endpoints
- Request timeouts
- Content Security Policy
- CORS configuration

These security features are automatically applied when the server starts, and can be customized in the `configureMiddleware` function in `src/server/index.js`.

## Model Configuration

You can configure different AI models by setting the `OPENROUTER_MODEL` environment variable. Some recommended models:

- `nvidia/llama-3.1-nemotron-nano-8b-v1:free` - Free tier model
- `anthropic/claude-3-opus-20240229` - High quality but more expensive
- `meta-llama/llama-3-70b-instruct` - Good balance of cost and performance

Refer to the [OpenRouter documentation](https://openrouter.ai/docs) for a complete list of available models. 