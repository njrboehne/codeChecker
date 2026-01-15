# Code Quality Agent

A comprehensive, automated code quality checking system that can be integrated into any project. This agent provides:

- 🤖 **Cursor AI Integration** - Automatic code quality guidance via `.cursorrules`
- 🔍 **Automated Quality Checks** - Command-line script to scan your codebase
- 🚀 **CI/CD Integration** - GitHub Actions workflow for automated checks
- 📊 **Detailed Reports** - Actionable quality reports with severity levels

## Quick Start

### 1. Copy Files to Your Project

Copy these files/folders to your project root:

```
.cursorrules                    → Project root
scripts/quality-check.js        → scripts/ folder
.github/workflows/quality-check.yml → .github/workflows/ (optional)
```

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

### Security
- ✅ XSS vulnerabilities (`dangerouslySetInnerHTML` without sanitization)
- ✅ Type safety issues (`any` types)
- ✅ Console.log in production code

### Code Quality
- ✅ File size limits (500 lines max)
- ✅ Component size limits (300 lines max)
- ✅ Code duplication detection
- ✅ Missing tests

### Configuration
- ✅ Missing linting tools
- ✅ Missing testing frameworks

## Features

### Cursor AI Integration

The `.cursorrules` file automatically guides Cursor AI to:
- Flag security issues during coding
- Suggest code improvements
- Enforce coding standards
- Review code before committing

**Just ask Cursor:**
- "Review this code for quality issues"
- "Check for security vulnerabilities"
- "Does this follow our coding standards?"

### Automated Quality Checks

The `quality-check.js` script:
- Scans all TypeScript/JavaScript files
- Detects common quality issues
- Generates detailed reports
- Exits with appropriate codes for CI/CD

**Output includes:**
- 🔴 Critical issues (must fix)
- 🟠 High priority issues
- 🟡 Medium priority warnings
- 🔵 Low priority suggestions

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
quality-agent/
├── .cursorrules                    # Cursor AI rules
├── scripts/
│   └── quality-check.js           # Quality check script
├── .github/
│   └── workflows/
│       └── quality-check.yml      # GitHub Actions workflow
└── README.md                       # This file
```

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
