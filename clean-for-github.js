/**
 * Script to clean sensitive information before pushing to GitHub
 * 
 * This will:
 * 1. Reset .env to .env.example with placeholders
 * 2. Clean .cursor/mcp.json with placeholders
 * 3. Clean docker-compose.yml with placeholders
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

console.log(`${colors.blue}DocuGenius - GitHub Preparation Script${colors.reset}`);
console.log('Cleaning sensitive information before pushing to GitHub...\n');

// Ensure we're in the project root directory
const projectRoot = process.cwd();

// Files to clean
const filesToClean = [
  { 
    path: '.env', 
    template: '.env.example',
    message: 'Cleaning .env file with example template'
  },
  { 
    path: '.cursor/mcp.json', 
    message: 'Updating .cursor/mcp.json with placeholders',
    transform: (content) => {
      try {
        const json = JSON.parse(content);
        
        // Replace API keys with placeholders
        if (json.mcpServers?.docugenius?.env) {
          json.mcpServers.docugenius.env.OPENROUTER_API_KEY = '${OPENROUTER_API_KEY}';
        }
        
        if (json.mcpServers?.github?.env) {
          json.mcpServers.github.env.GITHUB_PERSONAL_ACCESS_TOKEN = '${GITHUB_PERSONAL_ACCESS_TOKEN}';
        }
        
        return JSON.stringify(json, null, 2);
      } catch (error) {
        console.error(`${colors.red}Error parsing .cursor/mcp.json: ${error.message}${colors.reset}`);
        return content;
      }
    }
  },
  { 
    path: 'docker-compose.yml', 
    message: 'Updating docker-compose.yml with placeholders',
    transform: (content) => {
      // Replace hardcoded API keys with environment variables
      content = content.replace(
        /OPENROUTER_API_KEY=sk-or-v1-[a-zA-Z0-9]+/g, 
        'OPENROUTER_API_KEY=${OPENROUTER_API_KEY}'
      );
      
      content = content.replace(
        /GITHUB_TOKEN=github_pat_[a-zA-Z0-9_]+/g, 
        'GITHUB_TOKEN=${GITHUB_TOKEN}'
      );
      
      return content;
    }
  }
];

// Process each file
for (const file of filesToClean) {
  const filePath = path.join(projectRoot, file.path);
  console.log(`${colors.yellow}[PROCESSING]${colors.reset} ${file.message}`);
  
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`${colors.yellow}[SKIPPED]${colors.reset} File ${file.path} does not exist`);
      continue;
    }
    
    // If there's a template, copy the template
    if (file.template) {
      const templatePath = path.join(projectRoot, file.template);
      if (fs.existsSync(templatePath)) {
        fs.copyFileSync(templatePath, filePath);
        console.log(`${colors.green}[SUCCESS]${colors.reset} Copied ${file.template} to ${file.path}`);
      } else {
        console.log(`${colors.red}[ERROR]${colors.reset} Template ${file.template} not found`);
      }
    } 
    // If there's a transform function, apply it
    else if (file.transform) {
      const content = fs.readFileSync(filePath, 'utf8');
      const transformedContent = file.transform(content);
      fs.writeFileSync(filePath, transformedContent);
      console.log(`${colors.green}[SUCCESS]${colors.reset} Transformed ${file.path}`);
    }
  } catch (error) {
    console.error(`${colors.red}[ERROR]${colors.reset} Failed to process ${file.path}: ${error.message}`);
  }
}

// Make logs directory if it doesn't exist (to prevent errors when starting)
const logsDir = path.join(projectRoot, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
  console.log(`${colors.green}[SUCCESS]${colors.reset} Created logs directory`);
}

// Make temp directory if it doesn't exist
const tempDir = path.join(projectRoot, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
  console.log(`${colors.green}[SUCCESS]${colors.reset} Created temp directory`);
}

console.log(`\n${colors.green}All files processed.${colors.reset} Your project is now ready for GitHub.`);
console.log(`\nNext steps:`);
console.log(`1. Run 'git status' to see what files have been modified`);
console.log(`2. Add files to git with 'git add .'`);
console.log(`3. Commit with 'git commit -m "Prepare for GitHub"'`);
console.log(`4. Push to GitHub with 'git push'`); 