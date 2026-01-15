# Quick Start Guide

## 🚀 For Your New Repo

Once you've created your repository, here's what to do:

### 1. Initialize the Repo

```bash
cd your-quality-agent-repo
git init
```

### 2. Add All Files

```bash
git add .
git commit -m "Initial commit: Code Quality Agent"
```

### 3. Push to GitHub

```bash
git remote add origin <your-repo-url>
git branch -M main
git push -u origin main
```

## 📦 What's Included

```
quality-agent/
├── .cursorrules                    # Cursor AI rules (copy to project root)
├── scripts/
│   └── quality-check.js           # Quality check script (copy to scripts/)
├── .github/
│   └── workflows/
│       └── quality-check.yml      # GitHub Actions (copy to .github/workflows/)
├── README.md                       # Main documentation
├── INSTALL.md                      # Installation guide
├── package.json                    # npm package config
└── .gitignore                      # Git ignore rules
```

## 👥 Sharing with Your Team

### Method 1: Direct Clone

Team members can:
```bash
git clone <your-repo-url>
cd quality-agent
# Then follow INSTALL.md to copy files to their projects
```

### Method 2: Git Submodule

In their projects:
```bash
git submodule add <your-repo-url> quality-agent
cp quality-agent/.cursorrules .
cp quality-agent/scripts/quality-check.js scripts/
```

### Method 3: Copy Files

Just copy the files directly:
- `.cursorrules` → project root
- `scripts/quality-check.js` → `scripts/` folder
- `.github/workflows/quality-check.yml` → `.github/workflows/`

## ✅ Testing

Test the agent works:

```bash
# In the quality-agent repo
node scripts/quality-check.js --project-root /path/to/test/project
```

## 📝 Next Steps

1. ✅ Create your GitHub repo
2. ✅ Push these files
3. ✅ Share the repo URL with your team
4. ✅ Team members follow INSTALL.md

That's it! Your team can now use this quality agent in any project.
