import path from 'path';
import { existsSync } from 'fs';

/**
 * Normalizes a path to proper Windows format if running on Windows
 * @param {string} inputPath - The input path that might be in Unix format or URL-encoded
 * @returns {string} - Properly formatted Windows path
 */
export function normalizeWindowsPath(inputPath) {
  if (process.platform !== 'win32') {
    return inputPath;
  }

  // First decode any URL encoding
  let decodedPath = decodeURIComponent(inputPath);

  // Remove any file:// protocol if present
  decodedPath = decodedPath.replace(/^file:\/\//, '');

  // If the path is already in Windows format (e.g., C:\path\to\dir), just normalize it
  if (/^[A-Za-z]:\\.+/.test(decodedPath)) {
    const normalizedPath = path.normalize(decodedPath);
    try {
      if (!existsSync(normalizedPath)) {
        throw new Error(`Path does not exist: ${normalizedPath}`);
      }
      return normalizedPath;
    } catch (error) {
      throw new Error(`Invalid path: ${normalizedPath} (${error.message})`);
    }
  }

  // Handle paths that start with /c/ or similar drive letter patterns
  const driveLetterMatch = decodedPath.match(/^\/([a-zA-Z])(?:%3A|\:)?(?:\/|\\)/);
  if (driveLetterMatch) {
    const driveLetter = driveLetterMatch[1].toUpperCase();
    // Find the start of the actual path after the drive letter pattern
    const pathStart = decodedPath.indexOf('/', 1);
    const remainingPath = pathStart !== -1 ? decodedPath.slice(pathStart + 1) : '';
    const normalizedPath = `${driveLetter}:\\${remainingPath.replace(/\//g, '\\')}`;
    
    // Verify the path exists
    try {
      if (!existsSync(normalizedPath)) {
        throw new Error(`Path does not exist: ${normalizedPath}`);
      }
      return normalizedPath;
    } catch (error) {
      throw new Error(`Invalid path: ${normalizedPath} (${error.message})`);
    }
  }

  // For other paths, just normalize using path.normalize
  const normalizedPath = path.normalize(decodedPath);
  
  // Verify the path exists
  try {
    if (!existsSync(normalizedPath)) {
      throw new Error(`Path does not exist: ${normalizedPath}`);
    }
    return normalizedPath;
  } catch (error) {
    throw new Error(`Invalid path: ${normalizedPath} (${error.message})`);
  }
} 