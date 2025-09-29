# Output Styles

Output styles control how Claude Code formats and structures responses.

## 📋 Available Styles

### 🐛 debug-focused
**When to use**: Debugging, fixing bugs, troubleshooting errors
**Best for**: Systematic problem analysis, root cause identification, error resolution
**Manual trigger**: Select when working on bugs, exceptions, or system failures

### 🏗️ architecture-focused
**When to use**: System design, scalability planning, architectural decisions
**Best for**: High-level design, technology evaluation, migration planning
**Manual trigger**: Select for architecture reviews, design patterns, system structure

### 👁️ code-review-focused
**When to use**: Code quality assessment, security audits, best practices review
**Best for**: PR reviews, quality checks, security analysis, refactoring recommendations
**Manual trigger**: Select when reviewing code or ensuring quality standards

### 🚀 feature-development-focused
**When to use**: Building new features, implementing functionality
**Best for**: Step-by-step feature implementation, phased development, task breakdown
**Manual trigger**: Select when creating new features or major enhancements

### 💡 enhanced-default *(Currently Active)*
**When to use**: General development tasks, mixed queries, exploratory questions
**Best for**: Adaptive responses that adjust to context automatically
**Manual trigger**: Default style - use for everyday development work

## 🎨 How to Switch Styles

### Option 1: UI Picker (Recommended)
Claude Code displays available output styles in the UI. Click to select the one you need.

### Option 2: Command Line
```bash
claude outputstyle list          # View available styles
claude outputstyle set <name>    # Switch to a specific style
```

### Option 3: Settings File
Edit `.claude/settings.json` and change the `outputStyle` value:
```json
{
  "outputStyle": "debug-focused"
}
```

## 💡 Usage Tips

- **Don't overthink it**: The `enhanced-default` style adapts to most situations
- **Switch when stuck**: If responses aren't quite right, try a specialized style
- **Match your task**: Debugging a bug? Use `debug-focused`. Building a feature? Use `feature-development-focused`
- **Experiment**: Try different styles to find what works best for your workflow

## 🔧 Customization

To create your own output style:

1. Create a new `.md` file in this directory
2. Add a frontmatter section with `name` and `description`
3. Define the response structure, tone, and format
4. Set it in `settings.json` or select it from the UI

Example:
```markdown
---
name: my-custom-style
description: Brief description of when to use this style
---

# My Custom Output Style

[Define your preferred response format here]
```