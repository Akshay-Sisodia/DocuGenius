import OpenAI from 'openai';
import path from 'path';
import NodeCache from 'node-cache';
import { logger } from '../../utils/logger.js';

class MCPManager {
  constructor() {
    // API configuration
    this.apiKey = process.env.OPENROUTER_API_KEY;
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is not set');
    }

    this.model = process.env.OPENROUTER_MODEL || 'nvidia/llama-3.1-nemotron-nano-8b-v1:free';
    
    logger.info(`Initializing MCPManager with model: ${this.model}`);
    
    // Initialize OpenAI client
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: this.apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/docugenius',
        'X-Title': 'DocuGenius',
      },
      defaultQuery: {
        'include_prompt': false, // Changed to false to reduce response size
      },
      maxRetries: 3,
      timeout: 120000, // 2 minute timeout
    });

    // Initialize cache with compression
    this.cache = new NodeCache({ 
      stdTTL: 3600,       // 1 hour cache TTL
      checkperiod: 600,   // Check for expired items every 10 minutes
      useClones: false,   // Save memory by not cloning objects
      maxKeys: 1000,      // Limit total cache items
      enableCompression: true // Enable data compression
    });

    // Initialize prompt cache for faster repeated processing
    this.promptCache = new NodeCache({
      stdTTL: 86400,      // 24 hour cache TTL for prompts
      useClones: false,   // Save memory by not cloning
      maxKeys: 500        // Limit prompt cache size
    });

    // Define allowed file extensions
    this.allowedExtensions = [
      // Documentation files
      '.md', '.mdx', '.markdown', '.txt', '.rst',
      // Source code files
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
      '.cs', '.go', '.rb', '.php', '.swift', '.kt', '.rs',
      // Web files
      '.html', '.css', '.scss', '.sass', '.less',
      // Config files
      '.json', '.yaml', '.yml', '.toml', '.ini', '.env.example',
      // Shell scripts
      '.sh', '.bash', '.zsh', '.fish'
    ];
    
    // Documentation types (constant for better optimization)
    this.DOC_TYPES = Object.freeze({
      OVERVIEW: 'overview.md',
      API_REFERENCE: 'api-reference.md',
      SETUP_GUIDE: 'setup-guide.md',
      DEVELOPER_GUIDE: 'developer-guide.md',
      ARCHITECTURE: 'architecture.md',
      FILE_DOCS: 'file-documentation.md'
    });

    // Queue for limiting concurrent API requests
    this.requestQueue = [];
    this.processingCount = 0;
    this.maxConcurrentRequests = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '3', 10);
  }

  /**
   * Process files and generate documentation with context
   */
  async processWithContext(content, context = {}) {
    try {
      // Generate cache key and check cache
      const cacheKey = this._generateCacheKey(content, context);
      const cachedResult = this.cache.get(cacheKey);
      
      if (cachedResult) {
        logger.info('Cache hit for documentation request', { cacheKey: cacheKey.substring(0, 16) });
        return cachedResult;
      }
      
      logger.info('Cache miss, generating documentation', { contextKeys: Object.keys(context) });
      
      // Parse and filter content
      const files = await this._parseContent(content);
      const filteredFiles = this._filterFiles(files);
      
      if (filteredFiles.length === 0) {
        throw new Error('No valid files to process after filtering');
      }

      // Generate documentation
      const docs = await this._generateDocumentation(filteredFiles, context);

      // Format the result
      const docFiles = Object.entries(docs).map(([filename, content]) => ({
        path: filename,
        content: content,
        type: 'documentation'
      }));

      // Cache the result
      this.cache.set(cacheKey, docFiles);
      return docFiles;
    } catch (error) {
      logger.error('Error in processWithContext:', {
        error: error.message,
        stack: error.stack,
        context: Object.keys(context)
      });
      throw this._handleError(error);
    }
  }

  /**
   * Generate a cache key from content and context
   */
  _generateCacheKey(content, context) {
    try {
      // Use hash function for more efficient cache keys
      if (Array.isArray(content)) {
        // Only use path and content length for cache key to reduce memory
        const contentHash = this._quickHash(content.map(file => 
          `${file.path}:${file.content ? file.content.length : 0}`
        ).join('|'));
        
        const contextKeys = Object.keys(context).sort().join('|');
        return `docs_${contentHash}_${this._quickHash(contextKeys)}`;
      }
      
      return `docs_${this._quickHash(JSON.stringify({
        contentLength: typeof content === 'string' ? content.length : 0,
        contextKeys: Object.keys(context).sort().join('|')
      }))}`;
    } catch (error) {
      logger.warn('Error generating cache key, using fallback:', error);
      return `docs_fallback_${Date.now()}`;
    }
  }

  /**
   * Quick hash function for faster cache key generation
   */
  _quickHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Parse and validate the input content
   */
  async _parseContent(content) {
    try {
      const files = typeof content === 'string' ? JSON.parse(content) : content;
      
      if (!Array.isArray(files)) {
        throw new Error('Content must be an array of files');
      }
      
      return files;
    } catch (error) {
      throw new Error(`Failed to parse content: ${error.message}`);
    }
  }

  /**
   * Filter out generated and unnecessary files
   */
  _filterFiles(files) {
    const maxIndividualFileSize = 1024 * 1024; // 1MB max file size
    const skippedDirs = [
      'dist', 'build', 'node_modules', 'coverage', '.cache', '__pycache__'
    ];
    const skippedExtensions = ['.pyc', '.pyo', '.pyd', '.so', '.dll', '.class', '.o', '.obj', '.log'];
    
    return files.filter(file => {
      if (!file.path || !file.content) {
        return false;
      }
      
      const filePath = file.path.toLowerCase();
      
      // Skip common generated/build directories (faster check)
      if (skippedDirs.some(dir => filePath.includes(dir))) {
        return false;
      }

      // Skip common generated files (faster check)
      const ext = path.extname(filePath);
      if (skippedExtensions.includes(ext)) {
        return false;
      }

      // Skip very large files
      if (file.content.length > maxIndividualFileSize) {
        logger.warn(`Skipping large file: ${file.path} (${file.content.length} bytes)`);
        return false;
      }

      // Allow files without extensions, especially for code snippets
      if (!ext) {
        return true;
      }

      // Check if extension is allowed
      if (!this.allowedExtensions.includes(ext)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Generate documentation for the project
   */
  async _generateDocumentation(files, context) {
    // Create project structure
    const structure = this._createFileStructure(files);

    // Determine which documentation types to generate based on file count
    const docTypesToGenerate = this._determineDocTypes(files);

    // Define documentation tasks
    const documentationTasks = docTypesToGenerate.map(type => ({
      type,
      prompt: this._createPromptForType(type, structure, context)
    }));

    // Process documentation in batches to control memory usage
    const batchSize = 2; // Process 2 doc types at a time
    const docResults = [];
    
    for (let i = 0; i < documentationTasks.length; i += batchSize) {
      const batch = documentationTasks.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async task => ({
          type: task.type,
          content: await this._processPrompt(task.prompt, task.type)
        }))
      );
      docResults.push(...batchResults);
    }

    // Create documentation object from results
    const docs = docResults.reduce((acc, doc) => {
      acc[doc.type] = doc.content;
      return acc;
    }, {});

    // Process individual files in chunks
    const fileChunks = this._chunkFilesBySize(files, 4000);
    
    // Process file documentation in controlled batches
    const fileDocs = [];
    const concurrencyLimit = Math.min(3, fileChunks.length);
    
    for (let i = 0; i < fileChunks.length; i += concurrencyLimit) {
      const batchChunks = fileChunks.slice(i, i + concurrencyLimit);
      const batchPromises = batchChunks.map(chunk => 
        this._processFileChunk(chunk, structure, context)
      );
      const batchResults = await Promise.all(batchPromises);
      fileDocs.push(...batchResults);
    }
    
    docs[this.DOC_TYPES.FILE_DOCS] = fileDocs.join('\n\n');

    // Add metadata to each documentation file
    return this._addMetadataToDocumentation(docs);
  }

  /**
   * Determine which doc types to generate based on file analysis
   */
  _determineDocTypes(files) {
    // Always include overview
    const types = [this.DOC_TYPES.OVERVIEW];
    
    // Check for API files
    const hasApiFiles = files.some(file => 
      file.path.includes('/api/') || 
      file.path.includes('/routes/') ||
      file.path.includes('/controllers/')
    );
    if (hasApiFiles) types.push(this.DOC_TYPES.API_REFERENCE);
    
    // Check for setup/config files
    const hasConfigFiles = files.some(file => 
      file.path.includes('package.json') ||
      file.path.includes('.env') ||
      file.path.includes('config') ||
      file.path.includes('setup')
    );
    if (hasConfigFiles) types.push(this.DOC_TYPES.SETUP_GUIDE);
    
    // Check for developer guide need
    if (files.length > 10) types.push(this.DOC_TYPES.DEVELOPER_GUIDE);
    
    // Check for architecture docs need
    const needsArchitecture = files.some(file => 
      file.path.includes('architecture') || 
      files.length > 20
    );
    if (needsArchitecture) types.push(this.DOC_TYPES.ARCHITECTURE);
    
    return types;
  }

  /**
   * Add metadata to documentation files
   */
  _addMetadataToDocumentation(docs) {
    const docsWithMetadata = {};
    const now = new Date().toISOString();
    
    for (const [filename, content] of Object.entries(docs)) {
      docsWithMetadata[filename] = {
        content,
        metadata: {
          generated: now,
          type: 'documentation',
          format: 'markdown'
        }
      };
    }
    
    return docsWithMetadata;
  }

  /**
   * Create a prompt for a specific documentation type
   */
  _createPromptForType(type, structure, context) {
    // Check if this prompt is already cached
    const promptCacheKey = `prompt_${type}_${this._quickHash(structure)}_${this._quickHash(JSON.stringify(context))}`;
    const cachedPrompt = this.promptCache.get(promptCacheKey);
    if (cachedPrompt) {
      return cachedPrompt;
    }
    
    // Create base prompt with essential context only to reduce token usage
    let contextStr = '';
    if (context) {
      // Keep only relevant context keys to reduce token usage
      const relevantKeys = ['requestId', 'model', 'isLocal', 'history'];
      const filteredContext = {};
      for (const key of relevantKeys) {
        if (context[key] !== undefined) filteredContext[key] = context[key];
      }
      contextStr = JSON.stringify(filteredContext, null, 2);
    }
    
    const basePrompt = `
Project Structure:
${structure}

Context:
${contextStr}
`;

    // Define prompts for each documentation type
    const prompts = {
      [this.DOC_TYPES.OVERVIEW]: `
Generate a comprehensive project overview document that includes:
${basePrompt}
1. Project Summary
   - High-level overview of the project
   - Main purpose and goals
   - Target users/audience

2. Key Features
   - List of main features and capabilities
   - Unique selling points

3. Technology Stack
   - Programming languages used
   - Frameworks and libraries
   - External services and dependencies

4. Project Organization
   - Directory structure explanation
   - Key files and their purposes
   - Code organization principles

Use Markdown formatting with appropriate headers and sections.
`,
      [this.DOC_TYPES.API_REFERENCE]: `
Generate detailed API reference documentation for the project:
${basePrompt}
Include:
1. API Endpoints (if applicable)
   - HTTP methods
   - Request/response formats
   - Authentication requirements
   - Example requests and responses

2. Public Functions and Classes
   - Method signatures
   - Parameter descriptions
   - Return values
   - Usage examples

3. Data Models
   - Schema definitions
   - Field descriptions
   - Validation rules

4. Error Handling
   - Error codes and messages
   - Error handling patterns
   - Recovery strategies

Use Markdown formatting with appropriate code blocks and examples.
`,
      [this.DOC_TYPES.SETUP_GUIDE]: `
Create a detailed setup and installation guide:
${basePrompt}
Include:
1. Prerequisites
   - Required software and tools
   - System requirements
   - Environment setup

2. Installation Steps
   - Step-by-step installation process
   - Configuration instructions
   - Environment variables setup

3. Running the Project
   - Development environment setup
   - Build process
   - Running tests
   - Common commands

4. Troubleshooting
   - Common issues and solutions
   - Debug tips
   - Support resources

Use Markdown formatting with command examples and code blocks.
`,
      [this.DOC_TYPES.DEVELOPER_GUIDE]: `
Create a comprehensive developer guide:
${basePrompt}
Include:
1. Development Environment
   - IDE setup and configuration
   - Required extensions/plugins
   - Development tools

2. Code Style Guide
   - Coding standards
   - Naming conventions
   - File organization

3. Development Workflow
   - Git workflow
   - Branch naming
   - Code review process
   - Testing requirements

4. Contributing Guidelines
   - How to contribute
   - Pull request process
   - Documentation requirements

Use Markdown formatting with examples and best practices.
`,
      [this.DOC_TYPES.ARCHITECTURE]: `
Create detailed architecture documentation:
${basePrompt}
Include:
1. System Architecture
   - High-level architecture diagram (using Mermaid)
   - Component interactions
   - Data flow

2. Design Patterns
   - Key design patterns used
   - Implementation examples
   - Pattern justifications

3. Security Architecture
   - Authentication/Authorization
   - Data protection
   - Security best practices

4. Performance Considerations
   - Scalability design
   - Performance optimizations
   - Resource management

Use Markdown with Mermaid diagrams for visual representations.
`
    };

    const prompt = prompts[type] || prompts[this.DOC_TYPES.OVERVIEW];
    
    // Cache the prompt
    this.promptCache.set(promptCacheKey, prompt);
    
    return prompt;
  }

  /**
   * Process a chunk of files
   */
  async _processFileChunk(files, structure, context) {
    const prompt = this._createPrompt(files, structure, context);
    return this._processPrompt(prompt, 'file-chunk');
  }

  /**
   * Process a prompt with retries and request queueing
   */
  async _processPrompt(prompt, promptType) {
    // Check for cached result
    const promptHash = this._quickHash(prompt);
    const cacheKey = `prompt_result_${promptHash}`;
    const cachedResult = this.promptCache.get(cacheKey);
    
    if (cachedResult) {
      logger.info('Using cached prompt result', { type: promptType });
      return cachedResult;
    }
    
    // Queue the request if we're at capacity
    if (this.processingCount >= this.maxConcurrentRequests) {
      logger.info('Queueing prompt processing', { 
        type: promptType,
        queueLength: this.requestQueue.length
      });
      
      return new Promise((resolve, reject) => {
        this.requestQueue.push({ prompt, promptType, resolve, reject });
      });
    }
    
    return this._executePromptProcessing(prompt, promptType);
  }
  
  /**
   * Execute prompt processing with retries
   */
  async _executePromptProcessing(prompt, promptType) {
    const maxRetries = 3;
    let lastError;
    
    this.processingCount++;
    
    try {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const completion = await this.openai.chat.completions.create({
            model: this.model,
            messages: [
              {
                role: 'system',
                content: 'You are a technical documentation expert specializing in code analysis and documentation generation.'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 4000,
          });

          // Enhanced logging of actual API response
          logger.debug('OpenRouter API response received', {
            modelUsed: completion?.model || this.model,
            responseSize: JSON.stringify(completion).length,
            hasChoices: Array.isArray(completion?.choices)
          });

          // Check if we received an error response instead of completions
          if (completion?.error) {
            logger.error('Error object in API response', { 
              errorMessage: completion.error.message,
              errorCode: completion.error.code
            });
            
            // Handle rate limit errors in the response object
            if (completion.error.code === 429) {
              const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
              logger.info(`Rate limited, retrying after ${backoffTime}ms`);
              await new Promise(resolve => setTimeout(resolve, backoffTime));
              continue;
            }
            
            throw new Error(`OpenRouter API error: ${completion.error.message}`);
          }

          // Validate response
          if (!completion) {
            throw new Error('Empty response from OpenRouter API');
          }
          
          if (!Array.isArray(completion.choices) || completion.choices.length === 0) {
            logger.error('Invalid API response structure', { 
              responseKeys: Object.keys(completion),
              responseType: typeof completion
            });
            throw new Error('Invalid response format from OpenRouter API');
          }

          const choice = completion.choices[0];
          if (!choice?.message?.content) {
            logger.error('Invalid content in API response', { 
              choiceKeys: Object.keys(choice || {}),
              messageKeys: Object.keys(choice?.message || {})
            });
            throw new Error('Invalid content in OpenRouter API response');
          }

          const result = choice.message.content;
          logger.info('Successfully generated documentation', {
            contentLength: result.length,
            promptType
          });
          
          // Cache the result
          const promptHash = this._quickHash(prompt);
          this.promptCache.set(`prompt_result_${promptHash}`, result);
          
          return result;

        } catch (error) {
          lastError = error;
          
          // Log error details with more context
          logger.error(`Error in OpenRouter API call (attempt ${attempt}/${maxRetries}):`, {
            error: error.message,
            errorName: error.name,
            promptType,
            statusCode: error.response?.status,
            responseData: error.response?.data,
            model: this.model
          });

          // Handle specific API errors
          if (error.response?.data?.error) {
            const apiError = error.response.data.error;
            logger.error('OpenRouter API returned an error', {
              apiErrorCode: apiError.code,
              apiErrorMessage: apiError.message,
              apiErrorType: apiError.type
            });
            
            // Handle rate limiting
            if (apiError.code === 429) {
              const retryAfter = error.response.headers?.['retry-after'] || Math.min(1000 * Math.pow(2, attempt - 1), 10000);
              logger.info(`Rate limited, retrying after ${retryAfter}ms`);
              await new Promise(resolve => setTimeout(resolve, retryAfter));
              continue;
            }
            
            // Handle model not found - suggest checking model name
            if (apiError.code === 404) {
              logger.error('Model not found error', { 
                requestedModel: this.model, 
                suggestion: 'Check OPENROUTER_MODEL environment variable'
              });
              throw new Error(`OpenRouter API error: Model '${this.model}' not found or unavailable`);
            }
            
            // Handle authentication and other errors
            if ([401, 402, 403].includes(apiError.code)) {
              throw new Error(`OpenRouter API error: ${apiError.message || 'Unknown API error'}`);
            }
          }

          // Network errors
          if (error.name === 'FetchError') {
            logger.error('Network error when calling OpenRouter API', { 
              cause: error.cause,
              errorCode: error.code
            });
          }

          // On final attempt, throw the error
          if (attempt === maxRetries) {
            throw this._handleError(lastError);
          }

          // Exponential backoff for retries
          const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          logger.info(`Retrying OpenRouter API call after ${backoffTime}ms backoff`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }

      throw lastError || new Error('Failed to process documentation');
    } finally {
      this.processingCount--;
      
      // Process next item in queue if any
      if (this.requestQueue.length > 0) {
        const nextRequest = this.requestQueue.shift();
        this._executePromptProcessing(nextRequest.prompt, nextRequest.promptType)
          .then(nextRequest.resolve)
          .catch(nextRequest.reject);
      }
    }
  }

  /**
   * Create the documentation prompt for a set of files
   */
  _createPrompt(files, structure, context) {
    // Only include essential file content to reduce token usage
    const fileContents = files.map(file => {
      const ext = path.extname(file.path).slice(1) || 'txt';
      
      // Truncate very large files
      const maxContentLength = 10000; // 10K chars max per file
      const content = file.content.length > maxContentLength 
        ? file.content.substring(0, maxContentLength) + '\n// ... content truncated ...'
        : file.content;
      
      return `
File: ${file.path}
\`\`\`${ext}
${content}
\`\`\`
`;
    }).join('\n\n');

    // Simplify context by only including essential keys
    const relevantContext = {};
    ['requestId', 'model'].forEach(key => {
      if (context[key]) relevantContext[key] = context[key];
    });

    return `
Analyze the following code files and generate comprehensive documentation.

Project Structure:
${structure}

Context:
${JSON.stringify(relevantContext, null, 2)}

Files to Document:
${fileContents}

Please generate documentation that includes:
1. Overview of the code's purpose and functionality
2. Key components and their interactions
3. Important functions, classes, and interfaces
4. Dependencies and requirements
5. Usage examples and best practices
6. Setup and configuration instructions

Use Markdown formatting with appropriate headers, code blocks, and sections.
`;
  }

  /**
   * Create a string representation of the file structure
   */
  _createFileStructure(files) {
    // Cap the structure representation to avoid excessive tokens
    const maxFilesToShow = 150;
    const filesToProcess = files.length > maxFilesToShow 
      ? files.slice(0, maxFilesToShow) 
      : files;
    
    // Create structure object
    const structure = {};
    for (const file of filesToProcess) {
      const parts = file.path.split('/');
      let current = structure;
      
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        current[part] = current[part] || {};
        current = current[part];
      }
      
      current[parts[parts.length - 1]] = 'file';
    }
    
    // Add note if files were truncated
    let structureStr = this._stringifyStructure(structure, 0);
    if (files.length > maxFilesToShow) {
      structureStr += `\n\n(Showing ${maxFilesToShow} of ${files.length} files)`;
    }
    
    return structureStr;
  }
  
  /**
   * Convert file structure object to string representation
   */
  _stringifyStructure(obj, level) {
    // Limit depth to avoid excessive nesting
    if (level > 5) return '  '.repeat(level) + '...more files...';
    
    const indent = '  '.repeat(level);
    return Object.entries(obj)
      .map(([key, value]) => {
        if (value === 'file') {
          return `${indent}📄 ${key}`;
        }
        return `${indent}📁 ${key}\n${this._stringifyStructure(value, level + 1)}`;
      })
      .join('\n');
  }

  /**
   * Split files into chunks by size for better processing
   */
  _chunkFilesBySize(files, maxTokensPerChunk) {
    const chunks = [];
    let currentChunk = [];
    let currentSize = 0;
    
    for (const file of files) {
      const fileSize = (file.content || '').length;
      
      // Handle excessively large files by processing them individually
      if (fileSize > maxTokensPerChunk) {
        // If we already have files in the current chunk, finalize it
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = [];
          currentSize = 0;
        }
        
        // Truncate the large file and process it individually
        const truncatedFile = {
          ...file,
          content: file.content.substring(0, maxTokensPerChunk) + 
                   '\n// Content truncated due to size limits'
        };
        
        chunks.push([truncatedFile]);
        continue;
      }
      
      // If adding this file would exceed the chunk size, start a new chunk
      if (currentSize + fileSize > maxTokensPerChunk && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [file];
        currentSize = fileSize;
      } else {
        currentChunk.push(file);
        currentSize += fileSize;
      }
    }
    
    // Add the last chunk if it has files
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
  
  /**
   * Handle and transform errors
   */
  _handleError(error) {
    // Log the detailed error
    logger.error('Handling error in MCPManager', {
      errorType: error.name,
      errorMessage: error.message,
      errorStack: error.stack?.split('\n').slice(0, 3).join('\n'),
      hasResponse: !!error.response
    });
    
    if (error.response?.data?.error) {
      const apiError = error.response.data.error;
      switch (apiError.code) {
        case 401: return new Error('Invalid OpenRouter API key');
        case 402: return new Error('Insufficient OpenRouter credits');
        case 404: return new Error(`Model not found: '${this.model}' - check OPENROUTER_MODEL setting`);
        case 429: return new Error('Rate limit exceeded - please try again later');
        default:  return new Error(`OpenRouter error: ${apiError.message || 'Unknown API error'}`);
      }
    }
    
    if (error.name === 'FetchError') {
      return new Error('Network error connecting to OpenRouter - please check your internet connection');
    }

    if (error.message.includes('Invalid response') || error.message.includes('Empty response')) {
      return new Error(`OpenRouter API response error: ${error.message}. This may be a temporary issue, please try again.`);
    }
    
    return error;
  }
}

export { MCPManager };
