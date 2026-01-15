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
const FORBIDDEN_PATTERNS = [
  { pattern: /dangerouslySetInnerHTML/g, severity: 'critical', message: 'XSS vulnerability: dangerouslySetInnerHTML without sanitization' },
  { pattern: /:\s*any(\[|\s|;|\))/g, severity: 'high', message: 'Type safety issue: any type used' },
  { pattern: /console\.log\(/g, severity: 'medium', message: 'console.log found (use proper logging)' },
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
    } else if (['.ts', '.tsx', '.js', '.jsx'].includes(extname(file))) {
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

function checkFile(filePath) {
  const relativePath = filePath.replace(projectRoot + '/', '');
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const lineCount = lines.length;
  
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
  
  // Check for forbidden patterns
  lines.forEach((line, index) => {
    FORBIDDEN_PATTERNS.forEach(({ pattern, severity, message }) => {
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
}

function checkForDuplicates() {
  const files = getAllFiles(projectRoot);
  const serviceFiles = files.filter(f => f.includes('Service.') || f.includes('service.'));
  
  // Group by base name to find potential duplicates
  const serviceMap = new Map();
  serviceFiles.forEach(file => {
    const baseName = file.split('/').pop().replace(/\.(ts|tsx|js|jsx)$/, '').toLowerCase();
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
