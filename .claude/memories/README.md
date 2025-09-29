# Claude Memory Files

**Purpose**: These files provide persistent context across Claude Code
conversations to improve continuity and reduce repetitive explanations.

**Created**: 2025-09-29

## What Are Memory Files?

Memory files are reference documents that help Claude understand your project
context, conventions, and infrastructure without needing to re-explain
everything in each conversation.

While Claude Code doesn't yet support the official memory tool API (which
requires beta header `context-management-2025-06-27`), these files serve a
similar purpose by providing:

- **Project context** that persists between sessions
- **Coding conventions** to maintain consistency
- **Deployment patterns** for infrastructure management
- **Database schema** reference for data modeling

## Available Memory Files

### 1. [project-context.md](project-context.md)

**Overview of the entire Arrakis project**

- Technology stack (Next.js 15, React 19, tRPC, Prisma, PostgreSQL 17)
- Project structure and organization
- Key features and capabilities
- Development workflow
- Environment variables

**When to reference**: Start of new conversations, when explaining the project
to others, when onboarding new features

### 2. [deployment-patterns.md](deployment-patterns.md)

**Render infrastructure and deployment workflows**

- Render workspace details and configuration
- Database setup (PostgreSQL 17 with pgvector)
- Web service configuration
- Deployment checklist and procedures
- Environment variables for dev/prod
- Troubleshooting common issues
- Cost management

**When to reference**: Deploying changes, debugging production issues, updating
infrastructure, cost optimization

### 3. [coding-conventions.md](coding-conventions.md)

**Code style, patterns, and best practices**

- TypeScript configuration and strict mode
- Naming conventions for files, variables, functions
- tRPC patterns and error handling
- React component structure
- Prisma query patterns
- Code quality scripts
- Git commit conventions
- Security best practices

**When to reference**: Writing new code, code reviews, refactoring, ensuring
consistency

### 4. [database-schema.md](database-schema.md)

**Complete database schema documentation**

- All Prisma models (Conversation, Message, ToolUse, ConversationEmbedding)
- Relationships and indexes
- Vector search operations (pgvector)
- Common query patterns
- Migration strategies
- Performance optimization tips

**When to reference**: Adding new models, querying data, optimizing database
performance, understanding data relationships

## How to Use These Files

### For Claude Code Users

When starting a new conversation, you can reference these files:

```
"Check the project context in .claude/memories/project-context.md"
"Review our coding conventions before implementing this feature"
"What's our deployment process? Check deployment-patterns.md"
```

### For Claude

Claude can reference these files automatically when needed:

- Read memory files at conversation start for context
- Reference specific files when questions arise
- Update files when project changes significantly
- Keep information current and accurate

## Maintenance

These files should be **updated when**:

- Major dependencies are upgraded
- Infrastructure changes (new services, database changes)
- Coding conventions evolve
- Database schema is modified
- New patterns or best practices emerge

## Future Enhancements

When Claude Code supports the official memory tool API:

1. **Automatic updates**: Claude can update memory files as it learns
2. **Semantic search**: Find relevant context quickly
3. **Cross-conversation learning**: Improve at recurring workflows
4. **Smart retrieval**: Only load relevant context (reduce token usage)

## File Format

All memory files use Markdown format with:

- Clear section headers
- Code examples
- "Last Updated" timestamp
- Links to related files
- Practical examples

## Related Resources

- [Claude Memory Tool Docs](https://docs.claude.com/en/docs/agents-and-tools/tool-use/memory-tool.md)
- [Project ROADMAP](../../docs/ROADMAP_PLANNER_IMPLEMENTATION.md)
- [Claude Code Settings](../settings.json)
- [Project README](../../README.md)

---

**Note**: These files are client-side references, not part of the official
Claude memory tool API. They serve as a lightweight alternative until full
memory tool support is available in Claude Code.