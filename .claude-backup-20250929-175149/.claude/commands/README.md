# Slash Commands

Custom workflows and context switchers for common development tasks.

## 🚀 Frequent Workflows

### `/deploy`
**Complete deployment workflow**
- Runs quality checks (lint, format, tests)
- Security validation with security-specialist agent
- Database migration checks
- Build verification
- Git commit and push
- Render deployment monitoring
- Post-deployment validation

**When to use**: Before deploying to production or staging

---

### `/review`
**Comprehensive code review**
- Switches to `code-review-focused` output style
- Quality analysis with `npm run check`
- Security review with `security-specialist` agent
- Architecture review if needed
- Database review for schema changes
- Test coverage verification
- Documentation check
- Generates prioritized review summary

**When to use**: Before merging PRs or reviewing code changes

---

## 🎯 Context Switching

### `/focus-frontend`
**Load React/Next.js context**
- Loads `src/app/` and `src/components/` structure
- Reviews component patterns and UI library
- Checks Tailwind CSS and styling configuration
- Analyzes API integration patterns
- Reviews frontend dependencies

**Ready for**: Component creation, UI development, styling, API integration

---

### `/focus-backend`
**Load API/server context**
- Reviews API routes and tRPC routers
- Loads business logic and services
- Checks authentication/authorization patterns
- Reviews external integrations
- Analyzes backend dependencies

**Ready for**: API development, business logic, integrations, security

---

### `/focus-database`
**Load database/Prisma context**
- Reads complete Prisma schema
- Reviews migration history
- Checks Neon configuration
- Analyzes query patterns
- Invokes `database-expert` agent

**Ready for**: Schema design, migrations, query optimization, Neon management

---

## 📖 How to Use Slash Commands

### In Claude Code UI
Type the command with a forward slash:
```
/deploy
/review
/focus-frontend
```

Claude Code will execute the workflow defined in the corresponding `.md` file.

### What Happens
1. The command file is loaded
2. Claude follows the workflow steps
3. Relevant agents are invoked
4. Context is switched or loaded
5. You get a guided experience for that task

## 💡 Tips

- **Use `/focus-*` commands** when starting work on a specific area
- **Use `/deploy`** as your pre-deployment checklist
- **Use `/review`** for thorough code reviews before merging
- Commands stack well: `/focus-frontend` then work, then `/review`, then `/deploy`

## 🔧 Creating Custom Commands

1. Create a `.md` file in this directory
2. Add frontmatter with `name` and `description`
3. Define the workflow steps
4. Use markdown checklists for tracking

Example:
```markdown
---
name: my-command
description: What this command does
---

# My Custom Command

## Workflow Steps

### 1. First Step
- [ ] Do something
- [ ] Do something else

### 2. Second Step
- [ ] Another task
```

## 🎨 Command Ideas

**Quality Gates**
- `/precommit` - Run all quality checks before committing
- `/security-scan` - Full security audit
- `/performance-check` - Performance analysis

**Project-Specific**
- `/feature [name]` - Start feature development workflow
- `/db:migrate` - Database migration workflow
- `/docs:update` - Regenerate documentation

**Context Helpers**
- `/focus:testing` - Load test context
- `/focus:config` - Review configuration
- `/focus:ci` - Review CI/CD setup