# Claude Code Hooks

Hooks are automated scripts that run at specific points in the Claude Code workflow. They enable security checks, auto-formatting, context injection, and more.

## 🪝 Active Hooks

### 📥 UserPromptSubmit: inject_context.py
**When it runs**: Before Claude processes your message
**What it does**: Injects current date/time and project context into every prompt
**Why it's useful**: Claude always knows the current date and project state
**Timeout**: 10 seconds

### 🛡️ PreToolUse: security_check.py
**When it runs**: Before Edit, MultiEdit, or Write operations
**What it does**: Blocks modifications to sensitive files (.env, credentials, secrets)
**Why it's useful**: Prevents accidental exposure of secrets and sensitive data
**Timeout**: 15 seconds

### ✨ PostToolUse: format_files.py
**When it runs**: After Edit, MultiEdit, or Write operations
**What it does**: Auto-formats code files with Biome (JS/TS/JSON/CSS) and Prettier (Markdown)
**Why it's useful**: Maintains consistent code style without manual formatting
**Timeout**: 60 seconds

## 🎯 Hook Lifecycle

```
1. You send a message
   ↓
2. [UserPromptSubmit] inject_context.py adds context
   ↓
3. Claude Code processes your request
   ↓
4. Claude Code wants to edit a file
   ↓
5. [PreToolUse] security_check.py validates the file
   ↓
6. File is edited (if allowed)
   ↓
7. [PostToolUse] format_files.py auto-formats the file
   ↓
8. Done!
```

## 🔧 Hook Configuration

Hooks are configured in [.claude/settings.json](../settings.json):

```json
{
  "hooks": {
    "UserPromptSubmit": [...],
    "PreToolUse": [...],
    "PostToolUse": [...]
  }
}
```

### Hook Types
- **UserPromptSubmit**: Runs before Claude processes your message
- **PreToolUse**: Runs before Claude uses a tool (Edit, Write, Bash, etc.)
- **PostToolUse**: Runs after Claude uses a tool
- **PreContextFetch**: Runs before fetching context
- **PostContextFetch**: Runs after fetching context

## 🛠️ Available Scripts

### inject_context.py
```python
# Adds useful context to every prompt
# - Current date and time
# - Project information
# - Custom context variables
```

### security_check.py
```python
# Prevents edits to sensitive files
# - Blocks .env files
# - Blocks credential files
# - Blocks secret configuration
# - Allows everything else
```

### format_files.py
```python
# Auto-formats code after changes
# - JS/TS/JSON/CSS → Biome
# - Markdown → Prettier
# - Robust error handling
# - Skips non-code files
```

### hooks_manager.py
```python
# Utility library for hook scripts
# - Input parsing
# - Output formatting
# - Error handling
```

## 💡 Usage Tips

### When Hooks Block Actions
If a hook blocks something you need:
```bash
# Check your hooks configuration
cat .claude/settings.json | grep -A 20 hooks

# Temporarily disable a hook by commenting it out in settings.json
# Or add file patterns to allow-lists in the hook script
```

### When Formatting Fails
If auto-formatting causes issues:
- Check that Biome and Prettier are installed
- Review the formatted output before committing
- Adjust formatting rules in `biome.json` or `.prettierrc`

### Adding Custom Hooks
Create a new hook script:

1. Write a Python script in `.claude/hooks/`
2. Make it executable and handle JSON input
3. Add to `settings.json`:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python .claude/hooks/my-hook.py",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

## 🚫 Disabling Hooks

To temporarily disable a hook:
1. Edit `.claude/settings.json`
2. Comment out or remove the hook configuration
3. Restart Claude Code

To disable all hooks:
```json
{
  "hooks": {}
}
```

## 📖 Learn More

- Hooks receive JSON input via stdin
- Hooks output JSON results via stdout
- Failed hooks can block operations (PreToolUse) or just warn (PostToolUse)
- Timeout protection prevents hanging operations
- All hooks run in the project's Python virtual environment