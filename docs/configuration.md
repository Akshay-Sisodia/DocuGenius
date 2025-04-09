# Configuration Guide

DocuGenius uses environment variables for configuration. These variables control server settings, API configurations, logging options, and more.

## Environment Variables

### Server Configuration

| Name | Type | Description | Required | Default |
|------|------|-------------|----------|---------|
| PORT | number | Server port number | No | 3000 |
| NODE_ENV | string | Application environment (development/production) | No | development |

### OpenRouter API Configuration

| Name | Type | Description | Required | Default |
|------|------|-------------|----------|---------|
| OPENROUTER_API_KEY | string | OpenRouter API key | Yes | - |
| OPENROUTER_MODEL | string | OpenRouter model to use | No | meta-llama/llama-4-maverick:free |

### Logging Configuration

| Name | Type | Description | Required | Default |
|------|------|-------------|----------|---------|
| LOG_LEVEL | string | Logging level (info/debug/error) | No | info |
| LOG_TO_CONSOLE | boolean | Whether to log to console | No | true |
| LOG_TO_FILE | boolean | Whether to log to file | No | true |
| LOG_FILE_PATH | string | Path to log file | No | ./combined.log |
| ERROR_LOG_FILE_PATH | string | Path to error log file | No | ./error.log |

### Repository Management

| Name | Type | Description | Required | Default |
|------|------|-------------|----------|---------|
| TEMP_DIR | string | Temporary directory path | No | ./temp |
| ENABLE_ZERO_PERSISTENCE | boolean | Enable zero persistence | No | false |

### File Size Limits

| Name | Type | Description | Required | Default |
|------|------|-------------|----------|---------|
| MAX_FILE_SIZE_KB | number | Maximum file size in KB | No | 500 |
| MAX_TOTAL_FILES | number | Maximum number of files to process | No | 100 |

## Example Configuration

Here's an example of a `.env` file with all the available configuration options:

```
PORT=3000
NODE_ENV=development

# OpenRouter API Key & Settings
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=meta-llama/llama-4-maverick:free

# Logging Configuration
LOG_LEVEL=info
LOG_TO_CONSOLE=true
LOG_TO_FILE=true
LOG_FILE_PATH=./combined.log
ERROR_LOG_FILE_PATH=./error.log

# Repository Management
TEMP_DIR=./temp
ENABLE_ZERO_PERSISTENCE=false

# Maximum content size and limits
MAX_FILE_SIZE_KB=500
MAX_TOTAL_FILES=100
```

## Configuration Best Practices

1. **Environment-Specific Configuration**: Use different configurations for development and production environments.
   ```
   NODE_ENV=production
   LOG_LEVEL=error
   LOG_TO_CONSOLE=false
   ```

2. **Secure API Keys**: Keep your OpenRouter API key secure and never commit it to version control.

3. **Logging Configuration**: Adjust logging settings based on your needs:
   - For development: Use `LOG_LEVEL=debug` and `LOG_TO_CONSOLE=true`
   - For production: Use `LOG_LEVEL=error` and ensure `LOG_TO_FILE=true`

4. **Performance Tuning**: Adjust `MAX_FILE_SIZE_KB` and `MAX_TOTAL_FILES` based on your server's resources.

5. **Zero Persistence**: Enable zero persistence (`ENABLE_ZERO_PERSISTENCE=true`) when processing sensitive repositories to ensure no data is stored after processing. 