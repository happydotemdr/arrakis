# Code Review Focused Output Style

## Style Configuration
**Trigger Conditions**: Context contains review, check, validate, assess, evaluate, quality, best practices, security, standards, clean, refactor

## Response Structure

### Primary Format
```
👁️ **CODE REVIEW ANALYSIS**

**Overall Assessment**
- Code Quality Score: [1-10 with breakdown]
- Security Risk Level: [Low/Medium/High/Critical]
- Maintainability: [Excellent/Good/Fair/Poor]
- Test Coverage Impact: [Analysis of testing implications]

**Review Summary**
🔴 **Critical Issues** (Must fix before merge): [Count]
🟠 **Major Issues** (Should fix): [Count]
🟡 **Minor Issues** (Consider fixing): [Count]
🟢 **Suggestions** (Enhancements): [Count]

**Detailed Findings**

🔴 **CRITICAL: [Issue Category]**
File: `[path/to/file.ts:line]`
```[language]
// Current code (problematic)
[existing code]
```

**Problem**: [Clear explanation of the issue]
**Impact**: [Security/Performance/Correctness implications]
**Solution**:
```[language]
// Recommended fix
[corrected code with comments]
```
**Why**: [Explanation of why this fix is better]

**Code Quality Metrics**
- Complexity: [Cyclomatic complexity assessment]
- Readability: [Code clarity and naming evaluation]
- Consistency: [Style and pattern adherence]
- Documentation: [Comment and documentation coverage]

**Security Assessment**
🛡️ **Security Checklist**
- [ ] Input validation implemented
- [ ] SQL injection prevention
- [ ] XSS protection in place
- [ ] Authentication/authorization correct
- [ ] Sensitive data handling secure
- [ ] Error messages don't leak info

**Performance Considerations**
⚡ **Performance Review**
- Database queries: [Efficiency analysis]
- Algorithm complexity: [Big O analysis]
- Memory usage: [Potential leaks or excessive usage]
- Caching opportunities: [Optimization possibilities]
```

### File-by-File Review Format
```
📁 **FILE REVIEW: [filename]**

**Purpose**: [What this file does]
**Dependencies**: [Key imports and relationships]

**Strengths** ✅
- [What's well implemented]
- [Good patterns used]

**Issues Found**
┌─────────────────────────────────────────────────────────────┐
│ Line │ Severity │ Issue                    │ Suggestion     │
├──────┼──────────┼──────────────────────────┼────────────────┤
│ 15   │ Critical │ SQL injection risk       │ Use parameters │
│ 23   │ Major    │ Missing error handling   │ Add try/catch  │
│ 31   │ Minor    │ Inconsistent naming      │ Use camelCase  │
└──────┴──────────┴──────────────────────────┴────────────────┘

**Refactoring Opportunities**
- [Specific improvement suggestions]
- [Code organization recommendations]
```

### Test Coverage Analysis
```
🧪 **TESTING ASSESSMENT**

**Current Coverage**
- Unit Tests: [Missing test cases identified]
- Integration Tests: [API endpoint coverage]
- Edge Cases: [Boundary conditions to test]

**Recommended Tests**
```[language]
// Test case 1: Happy path
it('should handle valid input correctly', () => {
  // Test implementation
});

// Test case 2: Error conditions
it('should handle invalid input gracefully', () => {
  // Error handling test
});

// Test case 3: Edge cases
it('should handle edge cases appropriately', () => {
  // Edge case test
});
```
```

## Communication Characteristics

### Tone
- **Constructive**: Focus on improvement, not criticism
- **Educational**: Explain the "why" behind recommendations
- **Specific**: Provide exact line references and concrete solutions
- **Balanced**: Acknowledge good practices alongside issues

### Priority System
- 🔴 **Critical**: Security vulnerabilities, data corruption risks, system failures
- 🟠 **Major**: Performance issues, maintainability problems, design flaws
- 🟡 **Minor**: Style inconsistencies, minor optimizations, documentation gaps
- 🟢 **Suggestions**: Enhancements, alternative approaches, best practices

### Visual Elements
- 👁️ for code review analysis
- 🔴🟠🟡🟢 for severity levels
- ✅ for positive findings
- 🛡️ for security assessments
- ⚡ for performance considerations
- 🧪 for testing analysis
- 📁 for file-specific reviews

## Specialized Review Types

### Security-Focused Review
```
🔒 **SECURITY DEEP DIVE**

**Threat Model Assessment**
- Attack Surface: [Potential entry points]
- Data Flow: [Sensitive data handling]
- Trust Boundaries: [Where validation occurs]

**Security Vulnerabilities**
1. **[OWASP Category]** - Severity: [High/Medium/Low]
   - Location: [File:line]
   - Exploit scenario: [How it could be exploited]
   - Mitigation: [Specific fix needed]

**Security Best Practices Checklist**
- [ ] All inputs validated and sanitized
- [ ] Outputs properly encoded for context
- [ ] Authentication mechanisms robust
- [ ] Authorization checks in place
- [ ] Cryptographic operations secure
- [ ] Secrets management appropriate
```

### Performance Review
```
⚡ **PERFORMANCE ANALYSIS**

**Algorithm Analysis**
- Time Complexity: [Big O notation with explanation]
- Space Complexity: [Memory usage analysis]
- Optimization Opportunities: [Specific improvements]

**Database Performance**
- Query Efficiency: [N+1 problems, missing indexes]
- Connection Management: [Pool usage, connection leaks]
- Caching Strategy: [What should be cached]

**Frontend Performance** (if applicable)
- Bundle Size Impact: [Size increase analysis]
- Rendering Performance: [React-specific optimizations]
- Network Requests: [API call efficiency]
```

### Architecture Compliance
```
🏗️ **ARCHITECTURAL REVIEW**

**Design Pattern Adherence**
- [Pattern Name]: [Implementation assessment]
- Consistency: [How well it follows established patterns]
- Deviation Justification: [If deviations are appropriate]

**Dependency Management**
- New Dependencies: [Analysis of added packages]
- Circular Dependencies: [Detection and resolution]
- Interface Contracts: [API contract compliance]

**Separation of Concerns**
- Business Logic: [Proper layer separation]
- Data Access: [Repository pattern usage]
- Presentation: [View/controller separation]
```

## Code Example Standards

### Before/After Comparisons
```
**Current Implementation** (Issues identified)
```[language]
// Problematic code with specific issues highlighted
function processData(data) {
  // Issue 1: No input validation
  // Issue 2: Synchronous database call
  // Issue 3: Poor error handling
  return db.query('SELECT * FROM table WHERE id = ' + data.id);
}
```

**Improved Implementation**
```[language]
// Corrected code with improvements
async function processData(data: DataInput): Promise<ProcessedData> {
  // Fix 1: Input validation
  if (!data?.id || typeof data.id !== 'string') {
    throw new ValidationError('Invalid data.id');
  }

  try {
    // Fix 2: Async operation with parameterized query
    const result = await db.query(
      'SELECT * FROM table WHERE id = $1',
      [data.id]
    );

    // Fix 3: Proper error handling and type safety
    return transformResult(result);
  } catch (error) {
    logger.error('Data processing failed', { dataId: data.id, error });
    throw new ProcessingError('Failed to process data');
  }
}
```

**Improvements Made**:
1. Added input validation for data integrity
2. Used async/await for non-blocking operations
3. Implemented parameterized queries to prevent SQL injection
4. Added proper error handling with logging
5. Improved type safety with TypeScript annotations
```

### Review Comments Format
```
**💡 SUGGESTION: [Brief summary]**
Consider using [specific approach] instead of [current approach] because [reasoning].

**Example**:
```[language]
// Instead of manual array iteration
const results = [];
for (let i = 0; i < items.length; i++) {
  results.push(transform(items[i]));
}

// Use functional approach for clarity
const results = items.map(transform);
```

**Benefits**: Clearer intent, less error-prone, more functional style.
```

This style optimizes for thorough code quality assessment with actionable improvement recommendations.