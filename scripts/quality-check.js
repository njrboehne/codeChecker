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
const SUPPORTED_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.html', '.htm', '.sql', '.cs', '.cshtml', '.razor'];

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

// C# / .NET patterns
const CSHARP_PATTERNS = [
  // SQL Injection risks
  { pattern: /SqlCommand\s*\([^)]*['"]\s*\+\s*['"]/gi, severity: 'critical', message: 'SQL injection risk: String concatenation in SqlCommand. Use parameterized queries with SqlParameter' },
  { pattern: /new\s+SqlCommand\s*\([^)]*\+/gi, severity: 'critical', message: 'SQL injection risk: String concatenation in SqlCommand constructor. Use SqlParameter instead' },
  { pattern: /CommandText\s*=\s*['"][^'"]*\+/gi, severity: 'critical', message: 'SQL injection risk: CommandText with string concatenation. Use SqlParameter' },
  // XSS vulnerabilities
  { pattern: /Html\.Raw\s*\(/gi, severity: 'critical', message: 'XSS vulnerability: Html.Raw() without encoding. Use Html.Encode() or Razor encoding' },
  { pattern: /Response\.Write\s*\([^)]*Request\[/gi, severity: 'critical', message: 'XSS vulnerability: Response.Write with Request data. Use Html.Encode()' },
  { pattern: /<%=\s*[^%]+Request\[/gi, severity: 'critical', message: 'XSS vulnerability: Direct Request output in ASPX. Use Server.HtmlEncode()' },
  // Insecure deserialization
  { pattern: /BinaryFormatter\.Deserialize/gi, severity: 'critical', message: 'Security risk: BinaryFormatter.Deserialize is insecure. Use JsonSerializer or DataContractSerializer' },
  { pattern: /JavaScriptSerializer\.Deserialize/gi, severity: 'high', message: 'Security risk: JavaScriptSerializer can be insecure. Validate input and use JsonSerializer' },
  { pattern: /SoapFormatter\.Deserialize/gi, severity: 'critical', message: 'Security risk: SoapFormatter.Deserialize is insecure. Use secure serialization' },
  // Hardcoded credentials
  { pattern: /password\s*=\s*['"][^'"]+['"]/gi, severity: 'critical', message: 'Hardcoded password found. Use ConfigurationManager or secure configuration' },
  { pattern: /ConnectionString\s*=\s*['"][^'"]*password[^'"]*['"]/gi, severity: 'critical', message: 'Hardcoded connection string with password. Use ConfigurationManager.AppSettings or User Secrets' },
  // Missing async/await
  { pattern: /\.Result\s*[;=]/g, severity: 'high', message: 'Blocking async call with .Result. Use await instead to avoid deadlocks' },
  { pattern: /\.Wait\s*\(/g, severity: 'high', message: 'Blocking async call with .Wait(). Use await instead to avoid deadlocks' },
  { pattern: /\.GetAwaiter\(\)\.GetResult\(\)/g, severity: 'high', message: 'Blocking async call with GetAwaiter().GetResult(). Use await instead' },
  // Missing disposal
  { pattern: /new\s+(SqlConnection|SqlCommand|FileStream|StreamReader|StreamWriter|HttpClient)\s*\(/g, severity: 'high', message: 'IDisposable resource created. Ensure proper disposal with using statement or try/finally' },
  // Console output
  { pattern: /Console\.(WriteLine|Write)\s*\(/g, severity: 'medium', message: 'Console.WriteLine found. Use ILogger or proper logging framework' },
  { pattern: /Debug\.(WriteLine|Write)\s*\(/g, severity: 'low', message: 'Debug.WriteLine found. Consider using ILogger for production logging' },
  // Exception handling
  { pattern: /catch\s*\(\s*Exception\s+e\s*\)\s*\{\s*\}/g, severity: 'high', message: 'Empty catch block. At minimum, log the exception' },
  { pattern: /catch\s*\(\s*Exception\s+e\s*\)\s*\{\s*throw\s*;\s*\}/g, severity: 'medium', message: 'Catch and rethrow without context. Consider adding logging or using throw; to preserve stack trace' },
  // Type safety
  { pattern: /\bobject\s+\w+\s*=/g, severity: 'medium', message: 'Using object type. Consider using specific types or generics' },
  { pattern: /var\s+\w+\s*=\s*new\s+object\s*\(/g, severity: 'medium', message: 'Creating object instance. Use specific types' },
  // Magic numbers
  { pattern: /\b\d{4,}\b/g, severity: 'low', message: 'Large magic number found. Consider extracting to named constant' },
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
      if (!['node_modules', 'dist', 'build', '.git', 'scripts', '.next', '.nuxt', 'coverage', '.vscode', '.idea', 'bin', 'obj', 'packages'].includes(file)) {
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
  } else if (['.cs', '.cshtml', '.razor'].includes(ext)) {
    return CSHARP_PATTERNS;
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

function checkCSharpFile(filePath, relativePath, content, lines) {
  // Check for IDisposable resources without using statements
  const disposableTypes = ['SqlConnection', 'SqlCommand', 'FileStream', 'StreamReader', 'StreamWriter', 'HttpClient', 'SqlDataReader'];
  disposableTypes.forEach(type => {
    const regex = new RegExp(`new\\s+${type}\\s*\\(`, 'g');
    let match;
    while ((match = regex.exec(content)) !== null) {
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      const afterMatch = content.substring(match.index);
      
      // Check if it's in a using statement
      const linesBefore = beforeMatch.split('\n').slice(-5).join('\n');
      if (!/using\s*\(/.test(linesBefore)) {
        // Check if it's assigned to a variable that might be disposed later
        const nextLines = afterMatch.split('\n').slice(0, 10).join('\n');
        const hasDispose = /\.Dispose\s*\(|using\s*\(/.test(nextLines);
        
        if (!hasDispose) {
          ISSUES.high.push({
            file: relativePath,
            line: lineNumber,
            message: `${type} created without using statement. Ensure proper disposal to avoid resource leaks.`,
            code: `using (var ${type.toLowerCase()} = new ${type}(...)) { ... }`
          });
        }
      }
    }
  });
  
  // Check for async methods without await (simplified check)
  lines.forEach((line, index) => {
    if (/async\s+(Task|Task<|void)\s+\w+\s*\(/.test(line)) {
      // Look ahead a few lines to see if there's an await
      const nextLines = lines.slice(index, Math.min(index + 20, lines.length)).join('\n');
      if (!/await\s+/.test(nextLines) && !/Task\.(Run|FromResult|CompletedTask)/.test(nextLines)) {
        ISSUES.medium.push({
          file: relativePath,
          line: index + 1,
          message: 'Async method found without await. Consider removing async keyword or add await calls.',
          code: line.trim().substring(0, 80)
        });
      }
    }
  });
  
  // Check for missing null checks on parameters (simplified - only flag obvious cases)
  lines.forEach((line, index) => {
    const publicMethodMatch = line.match(/public\s+(?:async\s+)?(?:static\s+)?\w+\s+\w+\s*\(([^)]*)\)/);
    if (publicMethodMatch && publicMethodMatch[1]) {
      const params = publicMethodMatch[1];
      // Only check non-nullable reference types (simplified check)
      if (!params.includes('?') && params.trim().length > 0) {
        // Look ahead to see if there are null checks
        const nextLines = lines.slice(index, Math.min(index + 15, lines.length)).join('\n');
        if (!/ArgumentNullException|==\s*null|is\s+null/.test(nextLines)) {
          ISSUES.medium.push({
            file: relativePath,
            line: index + 1,
            message: 'Public method with parameters missing null checks. Consider adding null validation.',
            code: line.trim().substring(0, 80)
          });
        }
      }
    }
  });
  
  // Check for missing XML documentation on public members
  const publicMemberRegex = /public\s+(?:static\s+)?(?:async\s+)?(class|interface|enum|struct|delegate|\w+\s+\w+)/g;
  let lastDocLine = -1;
  lines.forEach((line, index) => {
    if (/^\s*\/\/\/\s*</.test(line)) {
      lastDocLine = index;
    } else if (publicMemberRegex.test(line) && lastDocLine !== index - 1) {
      ISSUES.low.push({
        file: relativePath,
        line: index + 1,
        message: 'Public member missing XML documentation. Consider adding /// <summary> comments.',
        code: line.trim().substring(0, 80)
      });
    }
  });
  
  // Check for ConfigurationManager usage (good practice for .NET Framework)
  const hasConfigManager = content.includes('ConfigurationManager') || content.includes('System.Configuration');
  const hasHardcodedConfig = /(?:ConnectionString|AppSettings)\s*=\s*['"][^'"]+['"]/.test(content);
  
  if (hasHardcodedConfig && !hasConfigManager) {
    ISSUES.high.push({
      file: relativePath,
      line: 1,
      message: 'Hardcoded configuration values found. Use ConfigurationManager.AppSettings for .NET Framework projects.',
      code: 'ConfigurationManager.AppSettings["Key"]'
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
  } else if (['.cs', '.cshtml', '.razor'].includes(ext)) {
    checkCSharpFile(filePath, relativePath, content, lines);
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

function checkDotNetProjectFiles() {
  // Check for .csproj files
  const csprojFiles = [];
  const packagesConfigFiles = [];
  const configFiles = [];
  
  function findProjectFiles(dir) {
    if (!existsSync(dir)) {
      return;
    }
    
    const files = readdirSync(dir);
    
    files.forEach(file => {
      const filePath = join(dir, file);
      const stat = statSync(filePath);
      
      if (stat.isDirectory()) {
        if (!['node_modules', 'dist', 'build', '.git', 'scripts', '.next', '.nuxt', 'coverage', '.vscode', '.idea', 'bin', 'obj', 'packages'].includes(file)) {
          findProjectFiles(filePath);
        }
      } else {
        const ext = extname(file).toLowerCase();
        if (ext === '.csproj') {
          csprojFiles.push(filePath);
        } else if (file === 'packages.config') {
          packagesConfigFiles.push(filePath);
        } else if (['app.config', 'web.config'].includes(file.toLowerCase())) {
          configFiles.push(filePath);
        }
      }
    });
  }
  
  findProjectFiles(projectRoot);
  
  // Check .csproj files
  csprojFiles.forEach(csprojPath => {
    try {
      const content = readFileSync(csprojPath, 'utf-8');
      const relativePath = csprojPath.replace(projectRoot + '/', '');
      
      // Check for .NET Framework version (4.5.2 or higher)
      const targetFrameworkMatch = content.match(/TargetFramework[^>]*>([^<]+)</i);
      if (targetFrameworkMatch) {
        const targetFramework = targetFrameworkMatch[1];
        const versionMatch = targetFramework.match(/netframework(\d+\.\d+)/i) || targetFramework.match(/net(\d+\.\d+)/i);
        
        if (versionMatch) {
          const version = parseFloat(versionMatch[1]);
          if (version < 4.5) {
            ISSUES.high.push({
              file: relativePath,
              line: 0,
              message: `Target framework ${targetFramework} is below 4.5.2. Consider upgrading for security and feature support.`,
              code: '<TargetFramework>net452</TargetFramework> or higher'
            });
          }
        }
      } else {
        ISSUES.medium.push({
          file: relativePath,
          line: 0,
          message: 'TargetFramework not specified in .csproj file.',
          code: '<TargetFramework>net452</TargetFramework>'
        });
      }
      
      // Check for nullable reference types (good practice)
      if (!content.includes('Nullable') && !content.includes('EnableDefaultCompileItems')) {
        ISSUES.medium.push({
          file: relativePath,
          line: 0,
          message: 'Nullable reference types not enabled. Consider enabling for better null safety.',
          code: '<Nullable>enable</Nullable>'
        });
      }
      
      // Check for hardcoded connection strings in .csproj
      if (/ConnectionString[^>]*>[^<]*password/i.test(content)) {
        ISSUES.critical.push({
          file: relativePath,
          line: 0,
          message: 'Connection string with password found in .csproj. Move to app.config or use User Secrets.',
          code: 'Use ConfigurationManager or User Secrets'
        });
      }
      
    } catch (error) {
      ISSUES.medium.push({
        file: csprojPath.replace(projectRoot + '/', ''),
        line: 0,
        message: 'Could not read .csproj file',
        code: error.message
      });
    }
  });
  
  // Check packages.config for outdated packages
  packagesConfigFiles.forEach(packagesPath => {
    try {
      const content = readFileSync(packagesPath, 'utf-8');
      const relativePath = packagesPath.replace(projectRoot + '/', '');
      
      // Check for packages.config (NuGet 2.x style) - suggest migration to PackageReference
      ISSUES.medium.push({
        file: relativePath,
        line: 0,
        message: 'packages.config found. Consider migrating to PackageReference in .csproj for better dependency management.',
        code: 'Migrate to <PackageReference> in .csproj'
      });
      
      // Check for hardcoded credentials
      if (/password[^>]*>[^<]+/i.test(content)) {
        ISSUES.critical.push({
          file: relativePath,
          line: 0,
          message: 'Password found in packages.config. Use secure configuration.',
          code: 'Remove hardcoded credentials'
        });
      }
    } catch (error) {
      // Ignore read errors
    }
  });
  
  // Check app.config and web.config for security issues
  configFiles.forEach(configPath => {
    try {
      const content = readFileSync(configPath, 'utf-8');
      const relativePath = configPath.replace(projectRoot + '/', '');
      
      // Check for hardcoded credentials in connection strings
      if (/connectionString[^>]*password[^>]*=[^>]*['"][^'"]+['"]/i.test(content)) {
        ISSUES.critical.push({
          file: relativePath,
          line: 0,
          message: 'Connection string with hardcoded password in config file. Use User Secrets or encrypted configuration.',
          code: 'Use User Secrets or ConfigurationManager with encrypted sections'
        });
      }
      
      // Check for debug mode in production
      if (/<compilation[^>]*debug[^>]*=.*true/i.test(content)) {
        ISSUES.high.push({
          file: relativePath,
          line: 0,
          message: 'Debug mode enabled in config. Disable for production deployments.',
          code: '<compilation debug="false">'
        });
      }
      
      // Check for custom errors disabled
      if (/<customErrors[^>]*mode[^>]*=.*off/i.test(content)) {
        ISSUES.medium.push({
          file: relativePath,
          line: 0,
          message: 'Custom errors disabled. Enable to prevent information disclosure.',
          code: '<customErrors mode="On" />'
        });
      }
      
    } catch (error) {
      // Ignore read errors
    }
  });
  
  // Check for test projects
  const testFiles = getAllFiles(projectRoot).filter(f => 
    f.includes('.test.') || 
    f.includes('.spec.') || 
    f.includes('Tests') ||
    f.includes('Test')
  );
  
  const hasTestProject = csprojFiles.some(f => 
    f.toLowerCase().includes('test') || 
    f.toLowerCase().includes('spec')
  );
  
  if (csprojFiles.length > 0 && !hasTestProject && testFiles.length === 0) {
    ISSUES.high.push({
      file: 'project',
      line: 0,
      message: '.NET project found but no test project detected. Consider adding unit tests.',
      code: 'Add MSTest, NUnit, or xUnit test project'
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
checkDotNetProjectFiles();

generateReport();
