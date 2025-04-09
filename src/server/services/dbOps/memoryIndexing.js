import { parentPort, workerData } from 'worker_threads';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

// Configuration parameters with defaults
const {
  batchSize = 1000,
  minTermLength = 3,
  stopWords = new Set(['and', 'the', 'for', 'with', 'this', 'that', 'from', 'not']),
  ignorePatterns = [/^\s*$/]  // Ignore empty lines by default
} = workerData || {};

// In-memory index structure
const memoryIndex = {
  termFrequency: new Map(), // Maps terms to documents and frequencies
  documentMetadata: new Map(), // Maps document IDs to metadata
  documentCount: 0,
  totalTerms: 0,
  stats: {
    indexingStartTime: Date.now(),
    totalProcessingTime: 0,
    memoryUsage: 0
  }
};

/**
 * Tokenize and normalize a text into terms
 * @param {string} text - The text to tokenize
 * @returns {Array<string>} - Array of normalized terms
 */
function tokenizeText(text) {
  if (!text || typeof text !== 'string') return [];
  
  // Normalize text: lowercase and remove non-alphanumeric characters
  const normalizedText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  
  // Split into terms and filter
  return normalizedText.split(/\s+/)
    .filter(term => 
      term.length >= minTermLength && 
      !stopWords.has(term) &&
      !ignorePatterns.some(pattern => pattern.test(term))
    );
}

/**
 * Generate a unique document ID
 * @param {string} content - Document content
 * @param {string} filePath - File path
 * @returns {string} - Document ID
 */
function generateDocumentId(content, filePath) {
  const hash = createHash('md5');
  hash.update(filePath + content.substring(0, 1000)); // Use path and first 1000 chars for quick hash
  return hash.digest('hex');
}

/**
 * Index a document and add it to the memory index
 * @param {string} content - Document content
 * @param {object} metadata - Document metadata
 * @returns {object} - Indexing stats
 */
function indexDocument(content, metadata) {
  const startTime = Date.now();
  
  // Generate document ID
  const docId = metadata.id || generateDocumentId(content, metadata.filePath);
  
  // Tokenize content
  const terms = tokenizeText(content);
  
  // Add document to metadata store
  memoryIndex.documentMetadata.set(docId, {
    ...metadata,
    id: docId,
    length: content.length,
    termCount: terms.length,
    indexedAt: new Date().toISOString()
  });
  
  // Update term frequency
  for (const term of terms) {
    if (!memoryIndex.termFrequency.has(term)) {
      memoryIndex.termFrequency.set(term, new Map());
    }
    
    const docFreq = memoryIndex.termFrequency.get(term);
    docFreq.set(docId, (docFreq.get(docId) || 0) + 1);
  }
  
  // Update stats
  memoryIndex.documentCount++;
  memoryIndex.totalTerms += terms.length;
  
  return {
    docId,
    termCount: terms.length,
    processingTime: Date.now() - startTime
  };
}

/**
 * Process a batch of files for indexing
 * @param {Array<object>} batch - Batch of file data to process
 * @returns {Array<object>} - Array of processing results
 */
async function processBatch(batch) {
  const results = [];
  
  for (const fileData of batch) {
    try {
      const content = await fs.readFile(fileData.filePath, 'utf8');
      
      const result = indexDocument(content, {
        filePath: fileData.filePath,
        fileName: path.basename(fileData.filePath),
        fileType: path.extname(fileData.filePath).slice(1),
        ...fileData.metadata
      });
      
      results.push({
        filePath: fileData.filePath,
        docId: result.docId,
        success: true,
        termCount: result.termCount,
        processingTime: result.processingTime
      });
    } catch (error) {
      results.push({
        filePath: fileData.filePath,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Main function to process files in batches
 * @param {Array<object>} files - Array of file data objects
 * @returns {object} - Processing results
 */
async function processFiles(files) {
  const startTime = Date.now();
  const results = {
    totalFiles: files.length,
    successCount: 0,
    errorCount: 0,
    processingTime: 0,
    errors: []
  };
  
  // Process in batches to manage memory
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchResults = await processBatch(batch);
    
    // Track progress
    const successfulOps = batchResults.filter(r => r.success);
    results.successCount += successfulOps.length;
    results.errorCount += batchResults.length - successfulOps.length;
    
    // Collect errors
    batchResults
      .filter(r => !r.success)
      .forEach(r => results.errors.push({
        filePath: r.filePath,
        error: r.error
      }));
    
    // Report progress to parent thread
    if (parentPort) {
      parentPort.postMessage({
        type: 'progress',
        processed: i + batch.length,
        total: files.length,
        percentComplete: Math.round(((i + batch.length) / files.length) * 100)
      });
    }
    
    // Force garbage collection between batches if available
    if (global.gc) {
      global.gc();
    }
  }
  
  results.processingTime = Date.now() - startTime;
  
  // Update memory stats
  memoryIndex.stats.totalProcessingTime = results.processingTime;
  memoryIndex.stats.memoryUsage = process.memoryUsage().heapUsed;
  
  return results;
}

/**
 * Search the memory index for documents matching query terms
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {Array<object>} - Search results
 */
function searchIndex(query, options = {}) {
  const {
    limit = 10,
    offset = 0,
    exactMatch = false,
    fields = null
  } = options;
  
  // Create query terms
  const queryTerms = tokenizeText(query);
  if (queryTerms.length === 0) return [];
  
  // Score documents
  const scores = new Map();
  
  for (const term of queryTerms) {
    // Skip terms that aren't in the index
    if (!memoryIndex.termFrequency.has(term)) continue;
    
    const matchingDocs = memoryIndex.termFrequency.get(term);
    
    for (const [docId, frequency] of matchingDocs.entries()) {
      const docData = memoryIndex.documentMetadata.get(docId);
      
      // Skip if we need to filter by field and this doc doesn't match
      if (fields && !fields.some(field => docData[field])) continue;
      
      // TF-IDF calculation
      const tf = frequency / docData.termCount; // Term frequency
      const idf = Math.log(memoryIndex.documentCount / matchingDocs.size); // Inverse document frequency
      const score = tf * idf;
      
      scores.set(docId, (scores.get(docId) || 0) + score);
    }
  }
  
  // If exactMatch is true, remove docs that don't contain all terms
  if (exactMatch) {
    for (const [docId] of scores.entries()) {
      for (const term of queryTerms) {
        if (!memoryIndex.termFrequency.has(term) || 
            !memoryIndex.termFrequency.get(term).has(docId)) {
          scores.delete(docId);
          break;
        }
      }
    }
  }
  
  // Sort by score and return results
  const sortedResults = Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(offset, offset + limit)
    .map(([docId, score]) => ({
      docId,
      score,
      document: memoryIndex.documentMetadata.get(docId)
    }));
  
  return sortedResults;
}

/**
 * Get index statistics
 * @returns {object} - Index statistics
 */
function getIndexStats() {
  return {
    documentCount: memoryIndex.documentCount,
    uniqueTerms: memoryIndex.termFrequency.size,
    totalTerms: memoryIndex.totalTerms,
    memoryUsageMB: Math.round(memoryIndex.stats.memoryUsage / (1024 * 1024) * 100) / 100,
    processingTimeMs: memoryIndex.stats.totalProcessingTime,
    avgTermsPerDocument: memoryIndex.documentCount > 0 
      ? Math.round(memoryIndex.totalTerms / memoryIndex.documentCount * 100) / 100
      : 0
  };
}

// Handle messages from parent thread
if (parentPort) {
  parentPort.on('message', async (message) => {
    try {
      switch (message.type) {
        case 'processFiles':
          const results = await processFiles(message.files);
          parentPort.postMessage({
            type: 'processFilesResult',
            results
          });
          break;
          
        case 'search':
          const searchResults = searchIndex(message.query, message.options);
          parentPort.postMessage({
            type: 'searchResult',
            results: searchResults
          });
          break;
          
        case 'getStats':
          const stats = getIndexStats();
          parentPort.postMessage({
            type: 'statsResult',
            stats
          });
          break;
          
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      parentPort.postMessage({
        type: 'error',
        error: error.message,
        stack: error.stack
      });
    }
  });
}

// Export functions for direct use
export {
  processFiles,
  searchIndex,
  getIndexStats,
  indexDocument,
  tokenizeText
}; 