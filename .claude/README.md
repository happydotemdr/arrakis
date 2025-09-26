# Claude Code Settings Guide - Arrakis Project

This document explains the Claude Code configuration for the Arrakis project.

## Settings Hierarchy

Claude Code uses a hierarchical settings system:

1. **Enterprise Policy** (System-wide) - Managed by IT
2. **Global User Settings** - `~/.claude/settings.json` (applies to all projects)
3. **Project Settings** - `C:\projects\arrakis\.claude\settings.json` ✅ **CONFIGURED**
4. **Local Project Settings** - `.claude/settings.local.json` (personal overrides, not in git)

## Current Configuration

### Security & Permissions ✅ ACTIVE

**Pre-approved (no prompts):**
- All npm scripts (`npm run check`, `npm run format`, etc.)
- Common git operations (status, diff, add, commit, log, branch, checkout, pull)
- Node.js and NPX commands

**Requires confirmation:**
- Git push operations
- File deletion/moving commands  
- Writing to package.json or .gitignore
- Web fetching

**Completely blocked:**
- Environment files (.env, .env.*)
- Secrets directories
- Credentials files
- Dangerous system commands (sudo, curl, wget)

### Workflow Optimizations ✅ ACTIVE

- **Auto-accept edits**: No constant prompts for file changes
- **Co-authorship tracking**: Credits Claude in git commits
- **Working directory maintained**: Stays in project folder between commands
- **45-day cleanup**: Keeps chat transcripts for 45 days
- **Performance optimized**: Reduces non-essential model calls

## Using Claude Code in Arrakis

### Start Claude Code
```bash
cd C:\projects\arrakis
claude code
```

### Essential Commands
```bash
# Your formatting workflow (all pre-approved!)
npm run check      # Lint + format check
npm run format     # Auto-format all files  
npm run lint:fix   # Fix linting issues

# Git workflow (most operations pre-approved)
git status         # ✅ Auto-approved
git add .          # ✅ Auto-approved  
git commit -m "..."# ✅ Auto-approved
git push           # ⚠️  Requires confirmation (safety)
```

### Managing Settings

**View current settings:**
```bash
claude config list
```

**Change a setting:**
```bash
claude config set <key> <value>
```

**Global settings:**
```bash
claude config set -g <key> <value>
```

## Personal Overrides

Create `.claude/settings.local.json` for personal preferences (automatically ignored by git):

```json
{
  "outputStyle": "Concise",
  "permissions": {
    "allow": [
      "Bash(docker *)",
      "Write(my-personal-notes.md)"
    ]
  }
}
```

## Advanced Features

### Custom Hooks (Optional)
Auto-run commands after Claude makes changes - see documentation for details.

### MCP Servers (Optional)  
Extend Claude with GitHub integration, database tools, etc.

### Additional Directories
Grant access to directories outside the current project in project-specific settings.

## Troubleshooting

**Permission denied error:** Check if command is in the "allow" list
**Unexpected prompts:** Command might be in the "ask" list  
**Settings not working:** Verify file is valid JSON with `claude config list`

## Security Notes

- Environment files and secrets are completely blocked from Claude's access
- Local settings override shared settings (use for personal preferences)  
- All dangerous system operations require explicit approval
- Git push operations require confirmation to prevent accidental pushes

---

*This configuration provides a secure, efficient foundation for the Arrakis project*