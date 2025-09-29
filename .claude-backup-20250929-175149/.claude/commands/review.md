---
name: review
description: Comprehensive code review with quality checks, security analysis, and best practices
---

# Code Review Workflow

Execute a thorough code review using specialized agents and quality tools.

## Workflow Steps

### 1. Switch to Review Context
- [ ] Activate `code-review-focused` output style
- [ ] Identify files/changes to review (git diff, specific files, or PR)

### 2. Quality Analysis
- [ ] Run `npm run check` to catch linting and formatting issues
- [ ] Review any errors or warnings
- [ ] Check for code complexity issues

### 3. Security Review
- [ ] Invoke `security-specialist` agent for vulnerability assessment
- [ ] Check for:
  - SQL injection risks
  - XSS vulnerabilities
  - Authentication/authorization issues
  - Sensitive data exposure
  - Input validation gaps

### 4. Code Quality Assessment
Review for:
- [ ] **Readability**: Clear naming, proper comments, logical structure
- [ ] **Maintainability**: DRY principles, single responsibility, testability
- [ ] **Performance**: Efficient algorithms, no N+1 queries, proper caching
- [ ] **Error Handling**: Proper try/catch, error messages, graceful degradation
- [ ] **Type Safety**: TypeScript types, Zod schemas, proper validation

### 5. Architecture Review
- [ ] Invoke `architecture-advisor` agent if architectural changes are present
- [ ] Check for:
  - Proper separation of concerns
  - Consistent patterns
  - Dependencies and coupling
  - Scalability implications

### 6. Database Review (if applicable)
- [ ] Invoke `database-expert` agent for schema/query changes
- [ ] Review:
  - Migration safety
  - Index optimization
  - Query efficiency
  - Data integrity constraints

### 7. Testing Coverage
- [ ] Verify unit tests for new/changed functionality
- [ ] Check integration test coverage
- [ ] Identify edge cases that need testing
- [ ] Run test suite to verify all tests pass

### 8. Documentation Check
- [ ] Verify code comments are clear and necessary
- [ ] Check if README needs updates
- [ ] Ensure API documentation is current
- [ ] Update inline documentation for complex logic

### 9. Generate Review Summary
Create a summary with:
- 🔴 **Critical Issues**: Must fix before merge
- 🟠 **Major Issues**: Should fix
- 🟡 **Minor Issues**: Consider fixing
- 🟢 **Suggestions**: Enhancements and improvements
- ✅ **Strengths**: What's well implemented

## Review Checklist

- [ ] All quality checks pass
- [ ] No security vulnerabilities found
- [ ] Code follows project patterns and standards
- [ ] Tests are comprehensive
- [ ] Documentation is updated
- [ ] Performance is acceptable
- [ ] No obvious bugs or edge cases missed

## Output

Provide detailed feedback organized by:
1. File-by-file analysis
2. Overall assessment score
3. Prioritized action items
4. Approval recommendation (Approve / Request Changes / Comment)