import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Configuration
const GIT_TIMEOUT = 120000; // 2 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

/**
 * GitExecutor - Handles git operations with retry logic and performance optimizations
 */
class GitExecutor {
  /**
   * Execute a git command with timeout and retry logic
   * @param {string} command - Git command to execute
   * @param {string} cwd - Working directory
   * @param {boolean} useExec - Whether to use exec or spawn (spawn is better for large outputs)
   * @returns {Promise<{stdout: string, stderr: string}>} - Command output
   */
  static async executeGitCommand(command, cwd, useExec = true) {
    let attempt = 0;
    let lastError = null;

    while (attempt < MAX_RETRIES) {
      try {
        if (useExec) {
          return await this.execWithTimeout(command, cwd);
        } else {
          return await this.spawnGitCommand(command, cwd);
        }
      } catch (error) {
        lastError = error;
        console.warn(`Git command failed (attempt ${attempt + 1}/${MAX_RETRIES}): ${command}`);
        console.warn(`Error: ${error.message}`);
        
        // Don't retry if the repository doesn't exist or access is denied
        if (error.message.includes('not a git repository') ||
            error.message.includes('does not exist') ||
            error.message.includes('Permission denied')) {
          break;
        }
        
        attempt++;
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
      }
    }

    throw new Error(`Git command failed after ${MAX_RETRIES} attempts: ${lastError.message}`);
  }

  /**
   * Execute git command using exec with timeout
   * @param {string} command - Git command
   * @param {string} cwd - Working directory
   * @returns {Promise<{stdout: string, stderr: string}>} - Command output
   */
  static async execWithTimeout(command, cwd) {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: GIT_TIMEOUT,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      return { stdout, stderr };
    } catch (error) {
      // Format error message for better debugging
      const formattedError = new Error(
        `Git command failed: ${command}\nError: ${error.message}` +
        (error.stderr ? `\nStderr: ${error.stderr}` : '')
      );
      formattedError.code = error.code;
      throw formattedError;
    }
  }

  /**
   * Execute git command using spawn (better for commands with large output)
   * @param {string} command - Git command (space-separated arguments)
   * @param {string} cwd - Working directory
   * @returns {Promise<{stdout: string, stderr: string}>} - Command output
   */
  static async spawnGitCommand(command, cwd) {
    return new Promise((resolve, reject) => {
      const args = command.split(' ');
      const gitCommand = args.shift();
      
      let stdout = '';
      let stderr = '';
      
      const childProcess = spawn(gitCommand, args, {
        cwd,
        shell: true
      });
      
      const timeout = setTimeout(() => {
        childProcess.kill();
        reject(new Error(`Git command timed out after ${GIT_TIMEOUT}ms: ${command}`));
      }, GIT_TIMEOUT);
      
      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      childProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          const error = new Error(`Git command failed with code ${code}: ${command}\nStderr: ${stderr}`);
          error.code = code;
          reject(error);
        }
      });
      
      childProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start git command: ${error.message}`));
      });
    });
  }

  /**
   * Clone a Git repository
   * @param {string} repoUrl - Repository URL
   * @param {string} targetPath - Clone destination
   * @param {string} branch - Branch to checkout (optional)
   * @param {boolean} shallow - Whether to do a shallow clone
   * @returns {Promise<void>}
   */
  static async cloneRepository(repoUrl, targetPath, branch = '', shallow = true) {
    // Create directory if it doesn't exist
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Build clone command
    let command = `git clone`;
    
    if (shallow) {
      command += ` --depth 1`;
    }
    
    if (branch) {
      command += ` -b ${branch}`;
    }
    
    command += ` ${repoUrl} ${targetPath}`;
    
    return this.executeGitCommand(command, process.cwd(), false);
  }

  /**
   * Check if a repository exists at the given path
   * @param {string} repoPath - Path to check
   * @returns {Promise<boolean>} - Whether the repo exists
   */
  static async isValidRepository(repoPath) {
    try {
      await this.executeGitCommand('git rev-parse --is-inside-work-tree', repoPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the current branch of a repository
   * @param {string} repoPath - Repository path
   * @returns {Promise<string>} - Current branch name
   */
  static async getCurrentBranch(repoPath) {
    try {
      const { stdout } = await this.executeGitCommand('git rev-parse --abbrev-ref HEAD', repoPath);
      return stdout.trim();
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error.message}`);
    }
  }

  /**
   * Get the latest commit hash
   * @param {string} repoPath - Repository path
   * @returns {Promise<string>} - Commit hash
   */
  static async getLatestCommitHash(repoPath) {
    try {
      const { stdout } = await this.executeGitCommand('git rev-parse HEAD', repoPath);
      return stdout.trim();
    } catch (error) {
      throw new Error(`Failed to get commit hash: ${error.message}`);
    }
  }

  /**
   * Fetch latest changes from remote
   * @param {string} repoPath - Repository path
   * @param {string} branch - Branch to fetch (optional)
   * @returns {Promise<void>}
   */
  static async fetchLatest(repoPath, branch = '') {
    let command = 'git fetch';
    if (branch) {
      command += ` origin ${branch}`;
    }
    return this.executeGitCommand(command, repoPath);
  }

  /**
   * Pull latest changes
   * @param {string} repoPath - Repository path
   * @returns {Promise<void>}
   */
  static async pullLatest(repoPath) {
    return this.executeGitCommand('git pull', repoPath);
  }

  /**
   * Checkout a specific branch
   * @param {string} repoPath - Repository path
   * @param {string} branch - Branch to checkout
   * @returns {Promise<void>}
   */
  static async checkoutBranch(repoPath, branch) {
    return this.executeGitCommand(`git checkout ${branch}`, repoPath);
  }

  /**
   * Get repository size (git objects only)
   * @param {string} repoPath - Repository path
   * @returns {Promise<number>} - Size in bytes
   */
  static async getRepositorySize(repoPath) {
    try {
      const { stdout } = await this.executeGitCommand('git count-objects -v', repoPath);
      // Extract size-pack from the output
      const match = stdout.match(/size-pack: (\d+)/);
      if (match && match[1]) {
        // Convert from KB to bytes
        return parseInt(match[1], 10) * 1024;
      }
      return 0;
    } catch (error) {
      console.warn(`Failed to get repository size: ${error.message}`);
      return 0;
    }
  }
}

export default GitExecutor; 