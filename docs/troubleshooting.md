# Troubleshooting Guide

This guide helps you diagnose and resolve common issues when working with DocuGenius.

## Common Issues and Solutions

### Server Startup Issues

#### Issue: Server Won't Start
- **Symptoms**: Error message when running `npm start` or `npm run dev`
- **Possible Causes**:
  - Missing dependencies
  - Invalid environment variables
  - Port already in use
- **Solutions**:
  1. Ensure all dependencies are installed: `npm install`
  2. Check your `.env` file for missing or invalid values
  3. Verify that the specified port is not in use by another application
  4. Check logs in `./combined.log` and `./error.log` for detailed error messages

#### Issue: OpenRouter API Key Error
- **Symptoms**: Error message about invalid or missing API key
- **Solutions**:
  1. Obtain a valid OpenRouter API key from [openrouter.ai](https://openrouter.ai)
  2. Update your `.env` file with the correct API key
  3. Verify that the API key is properly formatted with no extra spaces

### Repository Processing Issues

#### Issue: Repository Cloning Fails
- **Symptoms**: Error when processing a repository
- **Possible Causes**:
  - Invalid repository URL
  - Network issues
  - Git not installed
- **Solutions**:
  1. Verify that the repository URL is correct and accessible
  2. Check your network connection
  3. Ensure Git is installed and available in your PATH

#### Issue: Processing Takes Too Long
- **Symptoms**: Repository processing takes a long time or times out
- **Solutions**:
  1. Adjust `MAX_TOTAL_FILES` and `MAX_FILE_SIZE_KB` in your `.env` file
  2. Process smaller repositories or specific directories
  3. Use local repository processing for large repositories

#### Issue: Poor Documentation Quality
- **Symptoms**: Generated documentation is incomplete or low quality
- **Solutions**:
  1. Try a different OpenRouter model by updating `OPENROUTER_MODEL` in your `.env` file
  2. Improve the organization and documentation within your code
  3. Add more context to the API request when processing files

### API Request Issues

#### Issue: 400 Bad Request
- **Symptoms**: API returns a 400 status code
- **Solutions**:
  1. Verify that the request body includes all required fields
  2. Check the format of the request body
  3. Ensure the repository URL is properly formatted

#### Issue: 500 Internal Server Error
- **Symptoms**: API returns a 500 status code
- **Solutions**:
  1. Check the server logs for detailed error information
  2. Verify that the OpenRouter API is working correctly
  3. Check your server's memory and CPU usage

## Logging and Debugging

### Enabling Debug Logs
For more detailed logging, update your `.env` file:
```
LOG_LEVEL=debug
```

### Checking Logs
Review the log files for detailed error information:
```bash
# View combined logs
cat ./combined.log

# View error logs
cat ./error.log

# Monitor logs in real-time
tail -f ./combined.log
```

## Getting Support

If you're unable to resolve an issue using this guide:

1. Check the GitHub repository issues for similar problems
2. Submit a detailed bug report including:
   - Error messages
   - Steps to reproduce
   - Environment information (Node.js version, OS, etc.)
   - Log snippets 