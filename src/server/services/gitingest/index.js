import path from 'path';
import { promises as fs, existsSync, mkdirSync, statSync, readdirSync } from 'fs';
import crypto from 'crypto';
import os from 'os';
import { logger } from '../../utils/logger.js';
import { normalizeWindowsPath } from '../../utils/pathUtils.js';
import { fileURLToPath } from 'url';
import { rimraf } from 'rimraf';
import { Worker } from 'worker_threads';
import GitExecutor from './gitExecutor.js';

// Constants
const TEMP_DIR = path.join(os.tmpdir(), 'docugenius-repos');
const MAX_CONCURRENT_CLONES = 3;
const MAX_CONCURRENT_PROCESSES = 2;
const FILE_SIZE_LIMIT = 1024 * 1024; // 1MB
const CLONE_TIMEOUT_MS = 120000; // 2 minutes
const CACHE_EXPIRY_MS = 3600000; // 1 hour
const IGNORED_DIRS = [
  'node_modules', '.git', 'dist', 'build', 'coverage', 
  'out', '.next', '.nuxt', '.cache', '.github', 'vendor',
  'bower_components', 'target', '.idea', '.vscode'
];
const BINARY_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.pdf', 
  '.zip', '.tar', '.gz', '.7z', '.mp4', '.mp3', '.wav',
  '.webp', '.tiff', '.bin', '.exe', '.dll', '.so', '.dylib'
];

// Queue for managing concurrent operations
class OperationQueue {
  constructor(maxConcurrent, name = 'default') {
    this.queue = [];
    this.active = 0;
    this.maxConcurrent = maxConcurrent;
    this.name = name;
  }

  add(operation, priority = 0) {
    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject, priority });
      // Sort queue by priority (higher numbers = higher priority)
      this.queue.sort((a, b) => b.priority - a.priority);
      this.processNext();
    });
  }

  async processNext() {
    if (this.active >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const { operation, resolve, reject } = this.queue.shift();
    this.active++;
    logger.debug(`Queue ${this.name}: ${this.active} active, ${this.queue.length} pending`);

    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.active--;
      this.processNext();
    }
  }
  
  get pending() {
    return this.queue.length;
  }
  
  get activeCount() {
    return this.active;
  }
}

class GitIngestManager {
  constructor() {
    logger.info('Initializing GitIngestManager');
    this.cloneQueue = new OperationQueue(MAX_CONCURRENT_CLONES, 'clone');
    this.processQueue = new OperationQueue(MAX_CONCURRENT_PROCESSES, 'process');
    this.repoCache = new Map();
    this.ensureTempDir();
    
    // Set up cache cleanup interval
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, CACHE_EXPIRY_MS / 2);
  }

  /**
   * Ensure the temporary directory exists
   */
  ensureTempDir() {
    if (!existsSync(TEMP_DIR)) {
      logger.info(`Creating temp directory: ${TEMP_DIR}`);
      mkdirSync(TEMP_DIR, { recursive: true });
    }
  }

  /**
   * Get repository hash for consistent directory naming
   */
  getRepoHash(repoUrl, branch = 'main') {
    return crypto.createHash('md5').update(`${repoUrl}:${branch}`).digest('hex').substring(0, 10);
  }

  /**
   * Clone repository with timeout and retry
   */
  async cloneRepo(repoUrl, branch = 'main', priority = 0) {
    const repoHash = this.getRepoHash(repoUrl, branch);
    const repoPath = path.join(TEMP_DIR, repoHash);
    
    // Check if we've already processed this repo recently
    if (this.repoCache.has(repoHash)) {
      const cacheEntry = this.repoCache.get(repoHash);
      // Update access time
      cacheEntry.lastAccessed = Date.now();
      logger.info(`Using cached repo: ${repoUrl} (${branch}, ${repoHash})`);
      return cacheEntry.path;
    }

    // Add clone operation to queue
    return this.cloneQueue.add(async () => {
      logger.info(`Cloning repository: ${repoUrl} (${branch})`);
      
      // Clean up existing directory if it exists
      if (existsSync(repoPath)) {
        logger.info(`Cleaning up existing directory: ${repoPath}`);
        await rimraf(repoPath);
      }
      
      // Clone with timeout using GitExecutor
      try {
        await GitExecutor.cloneRepository(repoUrl, repoPath, {
          depth: 1,
          branch,
          singleBranch: true,
          noTags: true
        });
        
        logger.info(`Repository cloned successfully: ${repoUrl} (${branch})`);
        
        // Store in cache
        this.repoCache.set(repoHash, {
          path: repoPath,
          url: repoUrl,
          branch,
          created: Date.now(),
          lastAccessed: Date.now()
        });
        return repoPath;
      } catch (error) {
        logger.error(`Failed to clone repository: ${repoUrl}`, { error: error.message });
        
        // If branch doesn't exist, try with default branch
        if (error.message.includes('not found')) {
          try {
            logger.info(`Branch ${branch} not found, trying with default branch`);
            
            await GitExecutor.cloneRepository(repoUrl, repoPath, {
              depth: 1,
              singleBranch: true,
              noTags: true
            });
            
            // Get actual branch name
            const branchInfo = await GitExecutor.executeGitCommand(repoPath, ['branch']);
            const currentBranch = branchInfo.stdout.trim().replace('* ', '');
            logger.info(`Cloned with default branch: ${currentBranch}`);
            
            // Store in cache with actual branch
            this.repoCache.set(repoHash, {
              path: repoPath,
              url: repoUrl,
              branch: currentBranch,
              created: Date.now(),
              lastAccessed: Date.now()
            });
            return repoPath;
          } catch (retryError) {
            logger.error(`Failed to clone with default branch: ${repoUrl}`, { error: retryError.message });
            throw new Error(`Failed to clone repository: ${retryError.message}`);
          }
        }
        
        throw new Error(`Failed to clone repository: ${error.message}`);
      }
    }, priority);
  }

  /**
   * Process repository files
   */
  async processRepository(repoUrl, branch = 'main', priority = 0) {
    return this.processQueue.add(async () => {
      try {
        const startTime = Date.now();
        const repoPath = await this.cloneRepo(repoUrl, branch, priority);
        
        logger.info(`Processing repository files: ${repoUrl}`);
        const files = await this.readRepoFiles(repoPath);
        
        const processingTime = Date.now() - startTime;
        logger.info(`Repository processed: ${repoUrl}`, {
          fileCount: files.length,
          processingTimeMs: processingTime,
          estimatedMemory: this.estimateMemoryUsage(files)
        });
        
        return files;
      } catch (error) {
        logger.error(`Error processing repository: ${repoUrl}`, { error: error.message, stack: error.stack });
        throw new Error(`Failed to process repository: ${error.message}`);
      }
    }, priority);
  }

  /**
   * Estimate memory usage of processed files
   */
  estimateMemoryUsage(files) {
    const bytesInMB = 1024 * 1024;
    let totalBytes = 0;
    
    for (const file of files) {
      // Estimate string size (2 bytes per character in JavaScript)
      totalBytes += file.content.length * 2;
      totalBytes += file.path.length * 2;
      // Add overhead for object properties
      totalBytes += 128; // Rough estimate for object overhead
    }
    
    return `${(totalBytes / bytesInMB).toFixed(2)} MB`;
  }

  /**
   * Read all repository files using worker threads
   */
  async readRepoFiles(repoPath) {
    return new Promise((resolve, reject) => {
      // Create worker to process files
      const workerPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), './fileProcessorWorker.js');
      
      const worker = new Worker(workerPath, {
        workerData: {
          repoPath,
          ignoredDirs: IGNORED_DIRS,
          binaryExtensions: BINARY_EXTENSIONS,
          fileSizeLimit: FILE_SIZE_LIMIT
        }
      });
      
      // Set timeout for worker
      const workerTimeout = setTimeout(() => {
        logger.error(`Worker timeout processing repository: ${repoPath}`);
        worker.terminate();
        reject(new Error('Worker timed out processing repository files'));
      }, CLONE_TIMEOUT_MS * 1.5);
      
      // Handle worker messages
      worker.on('message', (files) => {
        clearTimeout(workerTimeout);
        logger.debug(`Worker completed processing ${files.length} files from ${repoPath}`);
        resolve(files);
      });
      
      // Handle worker errors
      worker.on('error', (error) => {
        clearTimeout(workerTimeout);
        logger.error(`Worker error processing repository: ${repoPath}`, { error: error.message });
        reject(new Error(`Failed to process repository files: ${error.message}`));
      });
      
      // Handle worker exit
      worker.on('exit', (code) => {
        clearTimeout(workerTimeout);
        if (code !== 0 && code !== null) {
          logger.error(`Worker exited with code ${code}`);
          reject(new Error(`Worker exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Clean up the cache based on last access time
   */
  cleanupCache() {
    try {
      const now = Date.now();
      const expiredEntries = [];
      
      // Find expired cache entries
      for (const [hash, entry] of this.repoCache.entries()) {
        if (now - entry.lastAccessed > CACHE_EXPIRY_MS) {
          expiredEntries.push(hash);
        }
      }
      
      // Remove expired entries
      if (expiredEntries.length > 0) {
        logger.info(`Cleaning up ${expiredEntries.length} expired cache entries`);
        
        for (const hash of expiredEntries) {
          const entry = this.repoCache.get(hash);
          this.repoCache.delete(hash);
          
          // Schedule directory removal
          if (existsSync(entry.path)) {
            rimraf(entry.path).catch(error => {
              logger.error(`Error removing directory ${entry.path}:`, { error: error.message });
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error during cache cleanup:', { error: error.message });
    }
  }

  /**
   * Clean up temporary directories
   */
  async cleanup(olderThanHours = 24) {
    try {
      logger.info('Cleaning up temporary directories');
      
      const now = Date.now();
      const threshold = now - (olderThanHours * 60 * 60 * 1000);
      
      // Read all directories in temp dir
      const dirs = readdirSync(TEMP_DIR);
      let removedCount = 0;
      
      for (const dir of dirs) {
        const dirPath = path.join(TEMP_DIR, dir);
        try {
          const stats = statSync(dirPath);
          
          // Remove if directory is older than threshold
          if (stats.mtime.getTime() < threshold) {
            logger.info(`Removing old directory: ${dirPath}`);
            await rimraf(dirPath);
            removedCount++;
            
            // Remove from cache if present
            if (this.repoCache.has(dir)) {
              this.repoCache.delete(dir);
            }
          }
        } catch (error) {
          logger.error(`Error processing directory ${dirPath}:`, { error: error.message });
          // Continue with next directory
        }
      }
      
      logger.info(`Cleanup completed: ${removedCount} directories removed`);
    } catch (error) {
      logger.error('Error during cleanup:', { error: error.message });
    }
  }
  
  /**
   * Get current queue status
   */
  getStatus() {
    return {
      cloneQueue: {
        active: this.cloneQueue.activeCount,
        pending: this.cloneQueue.pending
      },
      processQueue: {
        active: this.processQueue.activeCount,
        pending: this.processQueue.pending
      },
      cacheSize: this.repoCache.size,
      memoryUsage: process.memoryUsage()
    };
  }
  
  /**
   * Shut down the manager and clear intervals
   */
  shutdown() {
    logger.info('Shutting down GitIngestManager');
    clearInterval(this.cacheCleanupInterval);
  }
}

export { GitIngestManager };
