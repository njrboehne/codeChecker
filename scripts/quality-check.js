#!/usr/bin/env node

/**
 * Automated Code Quality Checker
 * 
 * This script performs automated code quality checks and generates a report.
 * Run with: node scripts/quality-check.js
 * 
 * Usage:
 *   node scripts/quality-check.js [--project-root <path>]
 * 
 * Options:
 *   --project-root <path>  Specify project root directory (default: current directory)
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
let projectRoot = process.cwd();

const projectRootIndex = args.indexOf('--project-root');
if (projectRootIndex !== -1 && args[projectRootIndex + 1]) {
  projectRoot = resolve(args[projectRootIndex + 1]);
}

// Configuration
const MAX_FILE_SIZE = 500; // lines
const MAX_COMPONENT_SIZE = 300; // lines

// Language-specific file extensions
const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.html', '.htm', '.sql'];

// TypeScript/JavaScript patterns
const TS_JS_PATTERNS = [
  { pattern: /dangerouslySetInnerHTML/g, severity: 'critical', message: 'XSS vulnerability: dangerouslySetInnerHTML without sanitization' },
  { pattern: /:\s*any(\[|\s|;|\))/g, severity: 'high', message: 'Type safety issue: any type used' },
  { pattern: /console\.log\(/g, severity: 'medium', message: 'console.log found (use proper logging)' },
  { pattern: /TODO|FIXME|HACK|XXX/g, severity: 'low', message: 'TODO/FIXME comment found' },
];

// Python patterns
const PYTHON_PATTERNS = [
  { pattern: /\beval\s*\(/g, severity: 'critical', message: 'Security risk: eval() can execute arbitrary code' },
  { pattern: /\bexec\s*\(/g, severity: 'critical', message: 'Security risk: exec() can execute arbitrary code' },
  { pattern: /\bpickle\.loads?\s*\(/g, severity: 'critical', message: 'Security risk: pickle.load() can execute arbitrary code. Use json or validate input' },
  { pattern: /\bprint\s*\(/g, severity: 'medium', message: 'print() found (use logging module for production code)' },
  { pattern: /\bAny\b/g, severity: 'high', message: 'Type safety: Any type used (from typing). Prefer specific types' },
  { pattern: /TODO|FIXME|HACK|XXX/g, severity: 'low', message: 'TODO/FIXME comment found' },
];

// HTML patterns
const HTML_PATTERNS = [
  { pattern: /<script[^>]*>(?!.*nonce)(?!.*CSP)[^<]*<\/script>/gi, severity: 'critical', message: 'Inline script without nonce/CSP protection (XSS risk)' },
  { pattern: /onclick\s*=/gi, severity: 'high', message: 'Inline event handler (onclick) - XSS risk. Use addEventListener instead' },
  { pattern: /onerror\s*=|onload\s*=|onmouseover\s*=/gi, severity: 'high', message: 'Inline event handler - XSS risk. Use addEventListener instead' },
  { pattern: /<img[^>]*(?!.*alt=)[^>]*>/gi, severity: 'medium', message: 'Image missing alt attribute (accessibility issue)' },
  { pattern: /<style[^>]*>(?!.*nonce)[^<]*<\/style>/gi, severity: 'medium', message: 'Inline styles without nonce/CSP protection' },
  { pattern: /javascript:/gi, severity: 'critical', message: 'javascript: protocol in href/src (XSS risk)' },
  { pattern: /TODO|FIXME|HACK|XXX/g, severity: 'low', message: 'TODO/FIXME comment found' },
];

// SQL patterns
const SQL_PATTERNS = [
  { pattern: /SELECT\s+.*\s+FROM\s+.*\s+WHERE\s+.*['"]\s*\+\s*['"]/gi, severity: 'critical', message: 'SQL injection risk: String concatenation in WHERE clause. Use parameterized queries' },
  { pattern: /INSERT\s+INTO\s+.*\s+VALUES\s*\([^)]*['"]\s*\+\s*['"]/gi, severity: 'critical', message: 'SQL injection risk: String concatenation in INSERT. Use parameterized queries' },
  { pattern: /UPDATE\s+.*\s+SET\s+.*['"]\s*\+\s*['"]/gi, severity: 'critical', message: 'SQL injection risk: String concatenation in UPDATE. Use parameterized queries' },
  { pattern: /password\s*=\s*['"][^'"]+['"]/gi, severity: 'critical', message: 'Hardcoded password found. Use environment variables or secure config' },
  { pattern: /(?:password|pwd|passwd)\s*=\s*['"][^'"]+['"]/gi, severity: 'critical', message: 'Hardcoded credentials found. Use environment variables' },
  { pattern: /SELECT\s+\*\s+FROM/gi, severity: 'medium', message: 'SELECT * found. Consider specifying columns explicitly' },
  { pattern: /TODO|FIXME|HACK|XXX/g, severity: 'low', message: 'TODO/FIXME comment found' },
];

const ISSUES = {
  critical: [],
  high: [],
  medium: [],
  low: [],
  info: []
};

// Helper functions
function getAllFiles(dir, fileList = []) {
  if (!existsSync(dir)) {
    return fileList;
  }
  
  const files = readdirSync(dir);
  
  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip common directories
      if (!['node_modules', 'dist', 'build', '.git', 'scripts', '.next', '.nuxt', 'coverage', '.vscode', '.idea'].includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else if (SUPPORTED_EXTENSIONS.includes(extname(file))) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function countLines(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch (error) {
    return 0;
  }
}

function getFileExtension(filePath) {
  return extname(filePath).toLowerCase();
}

function getPatternsForFile(filePath) {
  const ext = getFileExtension(filePath);
  
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    return TS_JS_PATTERNS;
  } else if (ext === '.py') {
    return PYTHON_PATTERNS;
  } else if (['.html', '.htm'].includes(ext)) {
    return HTML_PATTERNS;
  } else if (ext === '.sql') {
    return SQL_PATTERNS;
  }
  
  return [];
}

function checkPythonFile(filePath, relativePath, content, lines) {
  // Check for missing return type hints in function definitions
  // Only flag if function has parameter type hints but no return type hint
  const functionDefRegex = /^def\s+(\w+)\s*\(([^)]*)\)\s*:/;
  lines.forEach((line, index) => {
    const match = line.match(functionDefRegex);
    if (match) {
      const params = match[2];
      const hasParamTypeHints = /:\s*\w+/.test(params);
      const hasReturnTypeHint = line.includes('->');
      
      // If function has parameter type hints but no return type hint, suggest adding it
      if (hasParamTypeHints && !hasReturnTypeHint) {
        ISSUES.medium.push({
          file: relativePath,
          line: index + 1,
          message: `Function '${match[1]}' has parameter type hints but missing return type hint. Consider adding -> ReturnType`,
          code: line.trim().substring(0, 80)
        });
      }
    }
  });
  
  // Check for missing imports (logging, typing)
  const hasLogging = content.includes('import logging') || content.includes('from logging');
  const hasPrint = content.includes('print(');
  if (hasPrint && !hasLogging) {
    ISSUES.medium.push({
      file: relativePath,
      line: 1,
      message: 'print() statements found but logging module not imported. Use logging.getLogger() instead',
      code: 'import logging'
    });
  }
}

function checkHTMLFile(filePath, relativePath, content, lines) {
  // Check for missing DOCTYPE
  if (!content.trim().toLowerCase().startsWith('<!doctype')) {
    ISSUES.low.push({
      file: relativePath,
      line: 1,
      message: 'HTML file missing DOCTYPE declaration',
      code: '<!DOCTYPE html>'
    });
  }
  
  // Check for images without alt attributes (more thorough check)
  const imgTagRegex = /<img[^>]*>/gi;
  let match;
  let lineNumber = 1;
  while ((match = imgTagRegex.exec(content)) !== null) {
    const imgTag = match[0];
    if (!/alt\s*=/i.test(imgTag)) {
      // Find line number
      const beforeMatch = content.substring(0, match.index);
      lineNumber = beforeMatch.split('\n').length;
      
      ISSUES.medium.push({
        file: relativePath,
        line: lineNumber,
        message: 'Image missing alt attribute (accessibility issue)',
        code: imgTag.substring(0, 80)
      });
    }
  }
  
  // Check for form inputs without labels
  const inputRegex = /<input[^>]*id\s*=\s*['"]([^'"]+)['"][^>]*>/gi;
  const labelRegex = /<label[^>]*for\s*=\s*['"]([^'"]+)['"][^>]*>/gi;
  const inputIds = new Set();
  const labelFors = new Set();
  
  while ((match = inputRegex.exec(content)) !== null) {
    const idMatch = match[0].match(/id\s*=\s*['"]([^'"]+)['"]/i);
    if (idMatch) {
      inputIds.add(idMatch[1]);
    }
  }
  
  while ((match = labelRegex.exec(content)) !== null) {
    const forMatch = match[0].match(/for\s*=\s*['"]([^'"]+)['"]/i);
    if (forMatch) {
      labelFors.add(forMatch[1]);
    }
  }
  
  // Find inputs without corresponding labels
  inputIds.forEach(id => {
    if (!labelFors.has(id)) {
      ISSUES.medium.push({
        file: relativePath,
        line: 1,
        message: `Input with id="${id}" missing corresponding label (accessibility issue)`,
        code: `<label for="${id}">...</label>`
      });
    }
  });
}

function checkSQLFile(filePath, relativePath, content, lines) {
  // Check for parameterized query patterns (positive check)
  const hasParameterized = /[?$]\d+|:[\w]+|%s|%\([\w]+\)s/.test(content);
  const hasStringConcat = /['"]\s*\+\s*['"]/.test(content);
  
  if (hasStringConcat && !hasParameterized) {
    ISSUES.critical.push({
      file: relativePath,
      line: 1,
      message: 'SQL file contains string concatenation but no parameterized queries detected. High SQL injection risk.',
      code: 'Use parameterized queries: ? placeholders, named parameters, or prepared statements'
    });
  }
  
  // Check for DROP/TRUNCATE without safeguards
  if (/DROP\s+(TABLE|DATABASE)/gi.test(content) && !/IF\s+EXISTS/gi.test(content)) {
    ISSUES.high.push({
      file: relativePath,
      line: 1,
      message: 'DROP statement without IF EXISTS clause. Consider adding safety checks.',
      code: 'DROP TABLE IF EXISTS ...'
    });
  }
  
  // Check for missing transaction handling
  const hasTransactions = /BEGIN\s+TRANSACTION|START\s+TRANSACTION|COMMIT|ROLLBACK/gi.test(content);
  const hasMultipleStatements = (content.match(/;[\s]*$/gm) || []).length > 1;
  
  if (hasMultipleStatements && !hasTransactions) {
    ISSUES.medium.push({
      file: relativePath,
      line: 1,
      message: 'Multiple SQL statements found without explicit transaction handling',
      code: 'Wrap in BEGIN TRANSACTION ... COMMIT'
    });
  }
}

function checkFile(filePath) {
  const relativePath = filePath.replace(projectRoot + '/', '');
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const lineCount = lines.length;
  const ext = getFileExtension(filePath);
  
  // Check file size
  if (lineCount > MAX_FILE_SIZE) {
    ISSUES.high.push({
      file: relativePath,
      line: 1,
      message: `File is too large (${lineCount} lines). Consider splitting. Max recommended: ${MAX_FILE_SIZE} lines`,
      code: lines[0].substring(0, 50) + '...'
    });
  }
  
  // Check component size (for .tsx files)
  if (filePath.endsWith('.tsx') && lineCount > MAX_COMPONENT_SIZE) {
    ISSUES.medium.push({
      file: relativePath,
      line: 1,
      message: `Component is large (${lineCount} lines). Consider extracting logic into custom hooks. Max recommended: ${MAX_COMPONENT_SIZE} lines`,
      code: lines[0].substring(0, 50) + '...'
    });
  }
  
  // Get language-specific patterns
  const patterns = getPatternsForFile(filePath);
  
  // Check for language-specific patterns
  lines.forEach((line, index) => {
    patterns.forEach(({ pattern, severity, message }) => {
      if (pattern.test(line)) {
        ISSUES[severity].push({
          file: relativePath,
          line: index + 1,
          message,
          code: line.trim().substring(0, 80)
        });
      }
    });
  });
  
  // Language-specific additional checks
  if (ext === '.py') {
    checkPythonFile(filePath, relativePath, content, lines);
  } else if (['.html', '.htm'].includes(ext)) {
    checkHTMLFile(filePath, relativePath, content, lines);
  } else if (ext === '.sql') {
    checkSQLFile(filePath, relativePath, content, lines);
  }
}

function checkForDuplicates() {
  const files = getAllFiles(projectRoot);
  const serviceFiles = files.filter(f => 
    f.includes('Service.') || 
    f.includes('service.') ||
    f.includes('_service.') ||
    f.includes('_Service.')
  );
  
  // Group by base name to find potential duplicates
  const serviceMap = new Map();
  serviceFiles.forEach(file => {
    const ext = getFileExtension(file);
    const baseName = file.split('/').pop().replace(/\.(ts|tsx|js|jsx|py)$/, '').toLowerCase();
    if (!serviceMap.has(baseName)) {
      serviceMap.set(baseName, []);
    }
    serviceMap.get(baseName).push(file);
  });
  
  // Check for potential duplicates (same base name, different casing or location)
  serviceMap.forEach((files, baseName) => {
    if (files.length > 1) {
      const uniqueFiles = [...new Set(files.map(f => f.replace(projectRoot + '/', '')))];
      if (uniqueFiles.length > 1) {
        ISSUES.critical.push({
          file: 'services/',
          line: 0,
          message: `Potential duplicate service files detected: ${uniqueFiles.join(', ')}`,
          code: 'Consider consolidating into a single service file'
        });
      }
    }
  });
}

function checkForTests() {
  const files = getAllFiles(projectRoot);
  const testFiles = files.filter(f => 
    f.includes('.test.') || 
    f.includes('.spec.') || 
    f.includes('__tests__') ||
    f.includes('__test__')
  );
  
  if (testFiles.length === 0) {
    ISSUES.high.push({
      file: 'project',
      line: 0,
      message: 'No test files found. Consider adding tests for critical functionality.',
      code: 'Set up Vitest, Jest, or your preferred testing framework'
    });
  }
}

function checkPackageJson() {
  const packageJsonPath = join(projectRoot, 'package.json');
  
  if (!existsSync(packageJsonPath)) {
    ISSUES.info.push({
      file: 'package.json',
      line: 0,
      message: 'No package.json found. This may not be a Node.js project.',
      code: ''
    });
    return;
  }
  
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    // Check for security tools
    if (!packageJson.devDependencies?.eslint && !packageJson.devDependencies?.['@typescript-eslint/parser']) {
      ISSUES.medium.push({
        file: 'package.json',
        line: 0,
        message: 'ESLint not configured. Consider adding for code quality enforcement.',
        code: 'npm install -D eslint'
      });
    }
    
    // Check for testing framework
    const hasTestFramework = packageJson.devDependencies?.vitest || 
                             packageJson.devDependencies?.jest ||
                             packageJson.devDependencies?.['@testing-library/react'] ||
                             packageJson.devDependencies?.mocha ||
                             packageJson.devDependencies?.ava;
    
    if (!hasTestFramework) {
      ISSUES.high.push({
        file: 'package.json',
        line: 0,
        message: 'No testing framework found. Add Vitest, Jest, or your preferred testing framework.',
        code: 'npm install -D vitest @testing-library/react'
      });
    }
  } catch (error) {
    ISSUES.critical.push({
      file: 'package.json',
      line: 0,
      message: 'Could not read package.json',
      code: error.message
    });
  }
}

function generateReport() {
  const totalIssues = Object.values(ISSUES).flat().length;
  const criticalCount = ISSUES.critical.length;
  const highCount = ISSUES.high.length;
  const mediumCount = ISSUES.medium.length;
  const lowCount = ISSUES.low.length;
  
  console.log('\n' + '='.repeat(80));
  console.log('🔍 CODE QUALITY CHECK REPORT');
  console.log('='.repeat(80));
  console.log(`\nProject: ${projectRoot}`);
  console.log(`Total Issues Found: ${totalIssues}`);
  console.log(`  🔴 Critical: ${criticalCount}`);
  console.log(`  🟠 High: ${highCount}`);
  console.log(`  🟡 Medium: ${mediumCount}`);
  console.log(`  🔵 Low: ${lowCount}`);
  console.log(`  ℹ️  Info: ${ISSUES.info.length}`);
  
  // Print issues by severity
  ['critical', 'high', 'medium', 'low'].forEach(severity => {
    if (ISSUES[severity].length > 0) {
      console.log(`\n${severity.toUpperCase()} ISSUES:`);
      console.log('-'.repeat(80));
      
      ISSUES[severity].forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.file}:${issue.line}`);
        console.log(`   ${issue.message}`);
        if (issue.code) {
          console.log(`   Code: ${issue.code}`);
        }
      });
    }
  });
  
  // Summary
  console.log('\n' + '='.repeat(80));
  if (criticalCount > 0 || highCount > 0) {
    console.log('❌ QUALITY CHECK FAILED');
    console.log('   Please address critical and high-priority issues before proceeding.');
    process.exit(1);
  } else if (mediumCount > 0 || lowCount > 0) {
    console.log('⚠️  QUALITY CHECK PASSED WITH WARNINGS');
    console.log('   Consider addressing medium and low-priority issues.');
    process.exit(0);
  } else {
    console.log('✅ QUALITY CHECK PASSED');
    process.exit(0);
  }
}

// Main execution
console.log('Running code quality checks...\n');
console.log(`Scanning project: ${projectRoot}\n`);

const files = getAllFiles(projectRoot);
console.log(`Found ${files.length} files to scan...`);

files.forEach(checkFile);
checkForDuplicates();
checkForTests();
checkPackageJson();

generateReport();
