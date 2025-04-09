import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';

// Extract data from workerData
const { repoPath, ignoredDirs, binaryExtensions, fileSizeLimit } = workerData;

// Main processing function
async function processFiles() {
  try {
    const startTime = process.hrtime.bigint();
    const result = await processDirectory(repoPath);
    const endTime = process.hrtime.bigint();
    
    const processingTimeMs = Number(endTime - startTime) / 1_000_000;
    const memoryUsage = process.memoryUsage();
    
    // Log metrics
    console.log(`Processed ${result.length} files in ${processingTimeMs.toFixed(2)}ms`);
    console.log(`Memory usage: RSS ${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB, Heap ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    
    // Send result back to parent
    parentPort.postMessage(result);
  } catch (error) {
    console.error('Error processing files:', error);
    parentPort.postMessage({ error: error.message });
  }
}

// Process directory recursively
async function processDirectory(dirPath, relativeBase = '') {
  const files = [];
  let entries;
  
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error.message);
    return files; // Return empty array for inaccessible directories
  }

  // Process in batches to avoid memory spikes
  const batchSize = 100;
  const batches = [];
  
  for (let i = 0; i < entries.length; i += batchSize) {
    batches.push(entries.slice(i, i + batchSize));
  }
  
  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(async entry => {
        const entryPath = path.join(dirPath, entry.name);
        const relativePath = path.join(relativeBase, entry.name);
        
        if (entry.isDirectory()) {
          // Skip ignored directories
          if (ignoredDirs.includes(entry.name)) {
            return [];
          }
          
          // Process subdirectory
          try {
            return await processDirectory(entryPath, relativePath);
          } catch (error) {
            console.error(`Error processing directory ${entryPath}:`, error.message);
            return [];
          }
        } else if (entry.isFile()) {
          // Process file
          try {
            return await processFile(entryPath, relativePath);
          } catch (error) {
            console.error(`Error processing file ${entryPath}:`, error.message);
            return [];
          }
        }
        
        return []; // Default return for other entry types
      })
    );
    
    // Flatten and concatenate results
    for (const result of batchResults) {
      if (Array.isArray(result)) {
        files.push(...result);
      }
    }
    
    // Force garbage collection by clearing references
    global.gc && global.gc();
  }
  
  return files;
}

// Process individual file
async function processFile(filePath, relativePath) {
  // Skip file types in binary extensions list based on extension
  const ext = path.extname(filePath).toLowerCase();
  if (binaryExtensions.includes(ext)) {
    return [];
  }
  
  // Get file stats
  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch (error) {
    console.error(`Error getting stats for ${filePath}:`, error.message);
    return [];
  }
  
  // Skip files that are too large
  if (stats.size > fileSizeLimit) {
    console.log(`Skipping large file: ${relativePath} (${(stats.size / 1024).toFixed(2)} KB)`);
    return [];
  }
  
  // Read file content
  let content;
  try {
    content = fs.readFileSync(filePath);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return [];
  }
  
  // Additional check for binary files using file-type
  try {
    // Only check first 4KB of the file for efficiency
    const fileTypeResult = await fileTypeFromBuffer(content.slice(0, 4096));
    if (fileTypeResult) {
      // It's a binary file
      return [];
    }
  } catch (error) {
    // If fileTypeFromBuffer fails, continue processing
    console.error(`Error detecting file type for ${filePath}:`, error.message);
  }
  
  // Try to convert to string
  try {
    const contentString = content.toString('utf8');
    
    // Check if it's likely a binary file (contains too many null bytes or unprintable characters)
    const nonTextRatio = countNonPrintableChars(contentString) / contentString.length;
    if (nonTextRatio > 0.1) { // If more than 10% of characters are non-printable
      return [];
    }
    
    return [{
      path: normalizePath(relativePath),
      content: contentString,
      size: stats.size
    }];
  } catch (error) {
    console.error(`Error converting file ${filePath} to string:`, error.message);
    return [];
  }
}

// Helper function to count non-printable characters in a string
function countNonPrintableChars(str) {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // Count null bytes, control characters, and other non-printable characters
    if (code < 9 || (code > 10 && code < 32) || code === 127) {
      count++;
    }
  }
  return count;
}

// Normalize paths for consistent handling across platforms
function normalizePath(filePath) {
  // Convert backslashes to forward slashes for cross-platform consistency
  return filePath.replace(/\\/g, '/');
}

// Start processing
processFiles(); 