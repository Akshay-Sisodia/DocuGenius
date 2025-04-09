# Troubleshooting Guide

## Common Issues and Solutions

### API Key Issues

**Issue**: Invalid API key or authorization errors.

**Solution**:
1. Verify your OpenRouter API key in the `.env` file
2. Check the API key format (should not include "Bearer" prefix)
3. Ensure your API key has not expired or reached its rate limit
4. Try regenerating a new API key on OpenRouter

### Repository Processing Errors

**Issue**: Repository cloning or processing fails.

**Solution**:
1. Ensure the repository URL is correct and accessible
2. For private repositories, use an authentication token in the URL
3. Check if Git is installed and properly configured
4. Verify disk space for cloning repositories
5. Check permissions for the temporary directory

### Model Errors

**Issue**: AI model returns errors or poor quality documentation.

**Solution**:
1. Try a different model by updating `OPENROUTER_MODEL` in your `.env`
2. Check if the model supports the language you're documenting
3. Reduce the input size if it exceeds model limits
4. Ensure proper formatting of the input data

### Server Connection Issues

**Issue**: Connection refused or timeout errors.

**Solution**:
1. Verify the server is running (`npm start`)
2. Check if the port is available and not blocked by firewall
3. Ensure Docker container is running if using Docker setup
4. Check server logs for crash information

### Memory Issues

**Issue**: Out of memory errors when processing large repositories.

**Solution**:
1. Increase `MAX_HEAP_SIZE_MB` in your `.env` file
2. Process smaller batches of files instead of entire repositories
3. Optimize Docker container memory allocation
4. Consider running on a machine with more RAM

## Debugging

### Enabling Debug Logs

To enable more detailed logging, set the `LOG_LEVEL` environment variable to `debug`:

```bash
LOG_LEVEL=debug npm start
```

### Checking Logs

Logs are stored in the `logs` directory. For detailed error information, check:

```bash
cat logs/error.log
```

For all application logs:

```bash
cat logs/combined.log
```

### Performance Logging

To analyze performance bottlenecks, enable performance logging:

```bash
ENABLE_PERF_LOGGING=true npm start
```

Performance logs will be available in `logs/performance.log`.

## Common Error Messages

### "Invalid API response structure"

This error typically occurs when:
1. The OpenRouter API key is invalid or expired
2. The API service is experiencing downtime
3. The request payload is improperly formatted

Solution: Verify your API key and try again after a few minutes.

### "Failed to clone repository"

This error occurs when:
1. The repository URL is incorrect
2. Authentication credentials are missing for private repositories
3. Git is not installed or properly configured

Solution: Check the repository URL and ensure Git is properly installed.

### "Request timeout"

This error occurs when:
1. The request takes too long to process
2. The repository is too large
3. The API service is overloaded

Solution: Try processing smaller repositories or individual files.

## Getting Support

If you continue to experience issues:

1. Check the project's [GitHub issues](https://github.com/Akshay-Sisodia/DocuGenius/issues) for similar problems
2. Create a new issue with detailed information about the error
3. Include relevant log files and error messages
4. Specify your environment (OS, Node.js version, etc.) 