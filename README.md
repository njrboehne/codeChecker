# Code Quality AI Agent

An **AI-powered code quality agent** designed to work within Cursor IDE. This agent leverages Cursor's AI capabilities to provide intelligent, autonomous code quality guidance and automated quality checking.

**This is a true AI agent** because it:
- 🤖 **Uses Cursor's LLM** - Powered by Cursor AI for semantic code understanding
- 🧠 **Autonomous Decision-Making** - AI reasons about code quality and makes intelligent suggestions
- 🎯 **Context-Aware** - Understands code semantics, not just patterns
- 🔄 **Interactive** - Responds to developer questions and adapts to project context
- 🔍 **Automated Enforcement** - Command-line script for CI/CD and batch checking
- 🚀 **CI/CD Integration** - GitHub Actions workflow for automated checks
- 📊 **Detailed Reports** - Actionable quality reports with severity levels

> **Note**: This agent is designed to be used WITH Cursor IDE. When you add these files to your project, Cursor AI automatically becomes your code quality agent.

## Quick Start

### Prerequisites
- **Cursor IDE** (required) - This agent leverages Cursor's AI capabilities
- Node.js 18+ (for the quality check script)

### 1. Copy Files to Your Project

Copy these files/folders to your project root:

```
.cursorrules                    → Project root (activates Cursor AI agent)
scripts/quality-check.js        → scripts/ folder
.github/workflows/quality-check.yml → .github/workflows/ (optional)
```

**Once you add `.cursorrules` to your project, Cursor AI automatically becomes your code quality agent!**

### 2. Add to package.json

```json
{
  "scripts": {
    "quality": "node scripts/quality-check.js",
    "quality:check": "node scripts/quality-check.js"
  }
}
```

### 3. Run Quality Check

```bash
npm run quality
```

## What Gets Checked

### Supported Languages
- ✅ **TypeScript/JavaScript** (`.ts`, `.tsx`, `.js`, `.jsx`)
- ✅ **Python** (`.py`)
- ✅ **HTML** (`.html`, `.htm`)
- ✅ **SQL** (`.sql`)
- ✅ **C# / .NET** (`.cs`, `.cshtml`, `.razor`) - .NET Framework 4.5.2+

### Security
- ✅ XSS vulnerabilities (`dangerouslySetInnerHTML` without sanitization)
- ✅ Type safety issues (`any` types, Python `Any`)
- ✅ Console.log/print() in production code
- ✅ SQL injection risks (string concatenation in queries)
- ✅ Python security risks (`eval()`, `exec()`, `pickle.load()`)
- ✅ HTML XSS risks (inline scripts, event handlers, `javascript:` protocol)
- ✅ Hardcoded credentials in SQL files

### Code Quality
- ✅ File size limits (500 lines max)
- ✅ Component size limits (300 lines max for React components)
- ✅ Code duplication detection
- ✅ Missing tests
- ✅ Python type hints (missing return types when parameters have type hints)
- ✅ HTML accessibility (missing alt attributes, form labels)
- ✅ SQL best practices (parameterized queries, transaction handling)
- ✅ C# security (SQL injection, XSS, insecure deserialization)
- ✅ C# code quality (IDisposable patterns, async/await, null checks, XML documentation)
- ✅ .NET project configuration (.csproj, packages.config, app.config, web.config)

### Configuration
- ✅ Missing linting tools
- ✅ Missing testing frameworks

## Features

### 🤖 AI Agent Capabilities (via Cursor)

When you add this agent to your project, Cursor AI becomes your autonomous code quality agent:

**Autonomous Operation:**
- Monitors code as you write it
- Flags issues proactively without explicit requests
- Makes intelligent decisions about what to prioritize

**Intelligent Reasoning:**
- Understands code semantics and intent (not just syntax)
- Provides context-aware suggestions
- Explains *why* something is a problem, not just *that* it is

**Interactive & Adaptive:**
- Responds to your questions about code quality
- Adapts to your project's specific patterns
- Learns from your coding style

**Just ask Cursor:**
- "Review this code for quality issues"
- "Check for security vulnerabilities"
- "Does this follow our coding standards?"
- "How can I improve this component?"
- "What are the quality issues in this file?"

The AI agent will analyze your code semantically and provide intelligent, contextual feedback.

### Automated Quality Checks (Enforcement Layer)

The `quality-check.js` script provides automated enforcement:
- Scans TypeScript/JavaScript, Python, HTML, SQL, and C# files
- Detects common quality issues using pattern matching
- Language-specific checks for security, type safety, and best practices
- .NET Framework 4.5.2+ project file validation
- Generates detailed reports for CI/CD
- Works alongside the AI agent for comprehensive coverage

**Output includes:**
- 🔴 Critical issues (must fix)
- 🟠 High priority issues
- 🟡 Medium priority warnings
- 🔵 Low priority suggestions

> **Note**: The script provides fast, automated checking. For intelligent, context-aware analysis, use Cursor AI with the `.cursorrules` agent configuration.

### CI/CD Integration

The GitHub Actions workflow:
- Runs automatically on PRs and pushes
- Blocks merges if critical issues found
- Provides quality reports as artifacts

## Installation

### Option 1: Manual Copy

1. Copy `.cursorrules` to your project root
2. Copy `scripts/quality-check.js` to `scripts/` folder
3. (Optional) Copy `.github/workflows/quality-check.yml` to `.github/workflows/`

### Option 2: Git Submodule

```bash
git submodule add <this-repo-url> quality-agent
cp quality-agent/.cursorrules .
cp quality-agent/scripts/quality-check.js scripts/
cp -r quality-agent/.github/workflows/* .github/workflows/
```

### Option 3: npm Script Installer

```bash
# Create a setup script in your project
npx --yes <this-repo-url>/setup.js
```

## Usage

### Command Line

```bash
# Run quality check
npm run quality

# Or directly
node scripts/quality-check.js

# With custom project root
node scripts/quality-check.js --project-root /path/to/project
```

### Pre-commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/sh
npm run quality
if [ $? -ne 0 ]; then
  echo "Quality check failed. Commit aborted."
  exit 1
fi
```

Or use `husky`:

```bash
npm install -D husky
npx husky init
npx husky add .husky/pre-commit "npm run quality"
```

### VS Code Tasks

Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Quality Check",
      "type": "shell",
      "command": "npm run quality",
      "problemMatcher": []
    }
  ]
}
```

## Customization

### Adjust Quality Thresholds

Edit `scripts/quality-check.js`:

```javascript
const MAX_FILE_SIZE = 500;        // Change to your preference
const MAX_COMPONENT_SIZE = 300;   // Change to your preference
```

### Add Custom Rules

Edit `.cursorrules` to add project-specific guidelines:

```
## Custom Rules
- Always use our custom Button component
- Follow our naming convention: ComponentName.tsx
```

### Extend Quality Checks

Add new checks to `scripts/quality-check.js`:

```javascript
function checkCustomRule() {
  // Your custom quality check
  if (someCondition) {
    ISSUES.high.push({
      file: 'custom',
      line: 0,
      message: 'Custom rule violation',
      code: ''
    });
  }
}
```

## Integration Examples

### GitHub Actions

The included workflow runs automatically. To customize:

```yaml
# .github/workflows/quality-check.yml
- name: Run quality check
  run: node scripts/quality-check.js
  continue-on-error: true  # Don't fail the build
```

### GitLab CI

```yaml
# .gitlab-ci.yml
quality-check:
  script:
    - npm ci
    - node scripts/quality-check.js
```

### CircleCI

```yaml
# .circleci/config.yml
jobs:
  quality-check:
    steps:
      - run: npm ci
      - run: node scripts/quality-check.js
```

## Troubleshooting

### Cursor Rules Not Working

1. Ensure `.cursorrules` is in project root
2. Restart Cursor
3. Check Cursor settings for rules configuration

### Quality Check Script Fails

1. Ensure Node.js 18+ is installed
2. Check file permissions: `chmod +x scripts/quality-check.js`
3. Verify all dependencies are installed

### CI/CD Not Running

1. Check GitHub Actions is enabled for your repo
2. Verify workflow file is in `.github/workflows/`
3. Check Actions tab for error messages

## File Structure

```
code-quality-agent/
├── .cursorrules                    # Cursor AI agent configuration (activates AI agent)
├── scripts/
│   └── quality-check.js           # Automated quality check script
├── .github/
│   └── workflows/
│       └── quality-check.yml      # GitHub Actions workflow
└── README.md                       # This file
```

## How It Works

1. **Add `.cursorrules` to your project** → Cursor AI automatically becomes your code quality agent
2. **Write code in Cursor** → AI agent monitors and provides intelligent feedback
3. **Ask questions** → AI agent reasons about your code and suggests improvements
4. **Run quality check script** → Automated enforcement for CI/CD and batch checking

The AI agent works continuously in the background, providing intelligent code quality guidance as you develop.

## Contributing

Feel free to:
- Add new quality checks
- Improve existing rules
- Add support for more languages
- Enhance CI/CD integrations

## License

MIT License - feel free to use in any project.

## Support

For questions or issues:
- Check this README
- Review the quality check script comments
- Open an issue in the repository

---

**Version:** 1.0.0  
**Last Updated:** January 2026
