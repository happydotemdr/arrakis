# Git Workflow & Branching Strategy

This document establishes the branching strategy and workflow for the Arrakis project to prevent merge conflicts and maintain a clean repository.

## Branching Strategy

### Main Branches

- **`master`** - Production-ready code. Always stable.
- **`develop`** - Integration branch for features. Next release preparation.

### Supporting Branches

- **Feature branches** - `feature/description` or `feature/issue-number`
- **Release branches** - `release/version` (e.g., `release/1.0.0`)
- **Hotfix branches** - `hotfix/critical-fix`

## Workflow Guidelines

### 1. Feature Development

```bash
# Start from latest master
git checkout master
git pull origin master

# Create feature branch
git checkout -b feature/phase6-embeddings

# Work on feature
# ... make changes ...
git add .
git commit -m "feat: add embedding service"

# Push feature branch
git push -u origin feature/phase6-embeddings

# Create Pull Request on GitHub
gh pr create --title "Add Phase 6 Embeddings" --body "Implements vector embeddings for semantic search"
```

### 2. Pull Request Process

1. **Create PR** - Always create PR for feature branches
2. **Review** - Get code review (can be self-review for solo development)
3. **CI/CD** - Ensure all checks pass
4. **Merge** - Use "Squash and merge" for clean history

### 3. Emergency Hotfixes

```bash
# Start from master for critical fixes
git checkout master
git pull origin master

# Create hotfix branch
git checkout -b hotfix/fix-critical-bug

# Fix and commit
git add .
git commit -m "fix: resolve critical database connection issue"

# Push and create urgent PR
git push -u origin hotfix/fix-critical-bug
gh pr create --title "URGENT: Fix Database Connection" --body "Critical fix for production"
```

## Best Practices

### Commit Messages

Use conventional commits format:

```
type(scope): description

feat: add new feature
fix: bug fix
docs: documentation changes
style: formatting changes
refactor: code refactoring
test: adding tests
chore: maintenance tasks
```

### Before Committing

Always run these checks:

```bash
# Check what will be committed
git status
git diff --staged

# Run quality checks
npm run check  # Lint + format check
npm run build  # Ensure it builds
npm test       # Run tests (when available)
```

### Branch Naming

- `feature/phase6-embeddings` - Descriptive feature names
- `fix/unique-import-error` - Bug fixes
- `docs/update-readme` - Documentation updates
- `chore/update-dependencies` - Maintenance

## Conflict Resolution

### Prevention

1. **Frequent pulls** - `git pull origin master` regularly
2. **Small commits** - Make atomic, focused commits
3. **Clean workspace** - Always commit or stash before switching branches

### When Conflicts Occur

```bash
# Pull latest master
git checkout master
git pull origin master

# Rebase feature branch
git checkout feature/your-branch
git rebase master

# Resolve conflicts if any
# Edit conflicted files, then:
git add .
git rebase --continue

# Force push rebased branch
git push --force-with-lease origin feature/your-branch
```

### Emergency Conflict Resolution

If you're stuck in a merge conflict:

```bash
# Abort current merge/rebase
git merge --abort
# OR
git rebase --abort

# Start fresh
git checkout master
git pull origin master
git checkout -b feature/fresh-start
# Copy your changes manually
```

## Repository Hygiene

### What NOT to Commit

✅ **DO commit:**
- Source code files
- Configuration files (package.json, tsconfig.json)
- Documentation
- Tests

❌ **DON'T commit:**
- Build artifacts (.next/, dist/, build/)
- Dependencies (node_modules/)
- Environment files (.env, .env.local)
- IDE settings (personal .vscode/settings.json)
- Cache files
- Log files

### Cleaning Up

```bash
# Remove untracked files
git clean -fd

# Remove .next and caches
npm run clean

# Reset to clean state
git reset --hard HEAD
```

## GitHub Integration

### Pull Request Templates

Create `.github/pull_request_template.md`:

```markdown
## Summary
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass
- [ ] Manual testing completed
- [ ] No console errors

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] No merge conflicts
```

### Branch Protection Rules

Recommended settings for `master`:

- Require pull request reviews
- Require status checks to pass
- Require branches to be up to date
- Include administrators
- Allow force pushes: **NO**
- Allow deletions: **NO**

## Quick Reference

### Common Commands

```bash
# Start new feature
git checkout master && git pull origin master
git checkout -b feature/new-feature

# Daily workflow
git add .
git commit -m "feat: implement X"
git push

# Finish feature
gh pr create
# Merge via GitHub UI

# Clean up after merge
git checkout master
git pull origin master
git branch -d feature/completed-feature
```

### Troubleshooting

| Problem | Solution |
|---------|----------|
| Merge conflicts | `git rebase master`, resolve, `git rebase --continue` |
| Wrong branch | `git stash`, `git checkout correct-branch`, `git stash pop` |
| Bad commit | `git reset --soft HEAD~1` (before push) |
| Need to undo | `git revert <commit-hash>` (after push) |

## VS Code Integration

Use Command Palette (Ctrl+Shift+P):

- `Git: Create Branch` - Create new branch
- `Git: Checkout to` - Switch branches
- `Git: Pull` - Pull latest changes
- `Git: Push` - Push changes
- `GitLens: Compare` - Compare changes

## Automation

### Pre-commit Hooks

Consider adding pre-commit hooks:

```bash
npm install --save-dev husky
npx husky install
npx husky add .husky/pre-commit "npm run check"
```

### GitHub Actions

Automated checks on every PR:
- Linting and formatting
- TypeScript compilation
- Tests (when added)
- Build verification

---

**Remember:** When in doubt, create a backup branch before attempting complex git operations!