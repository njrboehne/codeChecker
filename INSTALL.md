# Installation Guide

This guide shows how to install the Code Quality Agent in your project.

## Quick Install

### Step 1: Copy Files

Copy these files to your project:

```bash
# From the quality-agent repository root
cp .cursorrules /path/to/your/project/
cp scripts/quality-check.js /path/to/your/project/scripts/
mkdir -p /path/to/your/project/.github/workflows
cp .github/workflows/quality-check.yml /path/to/your/project/.github/workflows/
```

### Step 2: Add npm Script

Add to your project's `package.json`:

```json
{
  "scripts": {
    "quality": "node scripts/quality-check.js",
    "quality:check": "node scripts/quality-check.js"
  }
}
```

### Step 3: Make Script Executable

```bash
chmod +x scripts/quality-check.js
```

### Step 4: Test It

```bash
npm run quality
```

## Installation Methods

### Method 1: Manual Copy (Recommended)

1. Clone or download this repository
2. Copy files as shown above
3. Commit to your project

### Method 2: Git Submodule

```bash
# Add as submodule
git submodule add <repo-url> quality-agent

# Copy files
cp quality-agent/.cursorrules .
cp quality-agent/scripts/quality-check.js scripts/
cp -r quality-agent/.github/workflows/* .github/workflows/

# Commit
git add .cursorrules scripts/quality-check.js .github/
git commit -m "Add code quality agent"
```

### Method 3: npm Package (Future)

```bash
npm install --save-dev code-quality-agent
```

Then copy the files from `node_modules/code-quality-agent/`.

## Post-Installation

### Enable Cursor Rules

The `.cursorrules` file works automatically in Cursor. Just restart Cursor if needed.

### Set Up Pre-commit Hook (Optional)

```bash
# Using husky
npm install -D husky
npx husky init
npx husky add .husky/pre-commit "npm run quality"
```

### Enable GitHub Actions (Optional)

The workflow file is already in place. Just push to GitHub and it will run automatically.

## Verification

Run the quality check:

```bash
npm run quality
```

You should see a report with any issues found in your codebase.

## Next Steps

- Customize thresholds in `scripts/quality-check.js`
- Add project-specific rules to `.cursorrules`
- Set up CI/CD integration
- Review the quality report and fix issues

## Troubleshooting

**Script not found?**
- Ensure `scripts/quality-check.js` exists
- Check file permissions: `chmod +x scripts/quality-check.js`

**Cursor rules not working?**
- Ensure `.cursorrules` is in project root
- Restart Cursor

**CI/CD not running?**
- Check GitHub Actions is enabled
- Verify workflow file location
