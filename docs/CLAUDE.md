# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 MANDATORY: Agent Usage Requirements

**You MUST proactively use specialized agents for these tasks:**

### Required Agent Delegation
When encountering these scenarios, you MUST immediately delegate to the appropriate agent:

1. **Database Tasks** → Use `database-expert` agent for:
   - Schema design, migrations, query optimization
   - PostgreSQL/Neon configuration
   - Database performance issues
   - Data modeling questions

2. **Security Tasks** → Use `security-specialist` agent for:
   - Vulnerability assessments
   - Authentication/authorization implementation
   - Security reviews and audits
   - Secure coding practices

3. **Performance Tasks** → Use `performance-optimizer` agent for:
   - Code optimization
   - Caching strategies
   - Load time improvements
   - Resource usage optimization

4. **Documentation Tasks** → Use `documentation-curator` agent for:
   - README updates
   - API documentation
   - Code comments and guides
   - Knowledge base maintenance

5. **Architecture Tasks** → Use `architecture-advisor` agent for:
   - System design decisions
   - Technology selection
   - Scalability planning
   - Design pattern implementation

### Parallelization Requirements
**ALWAYS run multiple independent tasks in parallel:**
- File searches: Use multiple Grep/Glob calls in a single message
- Code analysis: Launch multiple agents simultaneously
- Testing: Run multiple test commands in parallel
- When user says "in parallel": Send single message with multiple tool calls

### Hook Integration Status
✅ **Working Hooks:**
- `inject_context.py` - Provides datetime, git status, project context
- `security_check.py` - Blocks sensitive file modifications
- `capture-conversation.js` - Logs conversation events

⚠️ **Fixed Hook:**
- `format_files.py` - Now correctly parses Claude's `params` input

## Project Overview

**Arrakis** is a modern Next.js 15 conversation persistence system built with React 19, TypeScript, tRPC, and Prisma. It provides a comprehensive architecture for storing and managing conversational data with advanced features like vector embeddings and tool usage tracking.

**Current Status**: Full-featured Next.js application with conversation management, database persistence, and API infrastructure.

## Technology Stack

### Core Framework
- **Next.js 15.5.4** - App Router with React 19.1.1
- **TypeScript 5.9.2** - Full type safety throughout the application
- **Node.js 18+** - JavaScript runtime with modern features

### API & Database
- **tRPC 11.6.0** - End-to-end type-safe API layer
- **Prisma 6.16.2** - Database ORM with PostgreSQL
- **@tanstack/react-query 5.90.2** - Client-side data fetching and caching
- **pgvector** - Vector embeddings for semantic search

### UI & Styling
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui components** - Consistent design system
- **Lucide React** - Icon library

### Development Tools
- **ESLint 9 (flat config)** - Modern linting with Next.js and TypeScript support
- **Prettier** - Code formatting
- **TypeScript paths** - Clean import aliases

## Development Commands

```bash
# Development workflow
npm install              # Install dependencies
npm run dev             # Start development server (Next.js)
npm run build           # Build for production
npm start               # Start production server
npm run lint            # Run ESLint (using v9 flat config)
npm run lint:fix        # Run ESLint and auto-fix issues
npm run type-check      # TypeScript type checking
npm run check           # Run type-check and lint together

# Database operations
npm run db:generate     # Generate Prisma client
npm run db:push         # Push schema to database (development)
npm run db:migrate      # Create and run migrations
npm run db:deploy       # Deploy migrations (production)
npm run db:studio       # Open Prisma Studio GUI
npm run db:seed         # Seed database with sample data

# Code formatting
npm run format          # Format all files with Prettier
```

## Database Schema Architecture

The application uses a sophisticated conversation persistence schema:

### Core Models
- **Conversation** - Main conversation entity with metadata
- **Message** - Individual messages with role-based categorization
- **ToolUse** - Detailed tool usage tracking and performance metrics
- **ConversationEmbedding** - Vector embeddings for semantic search

### Key Features
- Session tracking for Claude Code conversations
- Tool usage analytics with duration and status tracking
- Vector embeddings using pgvector extension
- Comprehensive indexing for performance
- Cascade deletion for data integrity

## File Structure & Import Paths

```
src/
├── app/                           # Next.js App Router
│   ├── api/trpc/[trpc]/route.ts  # tRPC API handler
│   ├── conversations/            # Conversation pages
│   ├── globals.css               # Global Tailwind styles
│   ├── layout.tsx                # Root layout with providers
│   └── page.tsx                  # Home page
├── components/ui/                 # shadcn/ui components
├── lib/
│   ├── trpc/                     # tRPC client/server setup
│   ├── claude/                   # Claude-specific utilities
│   ├── db.ts                     # Prisma client instance
│   └── utils.ts                  # Utility functions
├── server/api/
│   ├── trpc.ts                   # tRPC initialization
│   ├── root.ts                   # API router composition
│   └── routers/                  # API route definitions
└── types/                        # TypeScript type definitions
```

### Import Aliases
- `@/*` - src directory root
- `@/components/*` - component imports
- `@/lib/*` - library utilities
- `@/server/*` - server-side code
- `@/app/*` - app directory imports

## tRPC API Architecture

The API is structured around conversation management with comprehensive CRUD operations:

### Main Router (`conversationRouter`)
- **Basic CRUD** - getAll, getById, create, update, delete
- **Message Management** - addMessage with tool call support
- **Tool Tracking** - addToolUse with performance metrics
- **Claude Integration** - createFromHook, updateFromHook for session tracking
- **Import System** - importFromTranscript for bulk conversation import
- **Analytics** - getStats for usage insights

### Type Safety
- Full end-to-end TypeScript coverage
- Zod validation for all inputs
- Superjson for complex data serialization
- Comprehensive error handling with ZodError formatting

## Configuration Files

### TypeScript (`tsconfig.json`)
- Strict mode enabled with comprehensive checks
- Path aliases for clean imports
- Next.js plugin integration
- ES2017 target for modern browser support

### ESLint (`eslint.config.js`)
- ESLint v9 flat configuration format
- Next.js and TypeScript recommended configs
- Comprehensive ignore patterns for build artifacts
- Relaxed rules for `any` types (warnings instead of errors)
- Disabled rules for CommonJS `require()` statements
- Direct ESLint CLI usage (migrated from deprecated `next lint`)

### Prettier (`.prettierrc`)
- No semicolons, single quotes
- 80-character line width
- Trailing commas (ES5 compatible)
- Arrow function parentheses avoided when possible

### Tailwind (`tailwind.config.ts`)
- shadcn/ui design system integration
- CSS custom properties for theming
- Extended color palette and radius system

## Development Workflow

### Database-First Development
1. Modify Prisma schema (`prisma/schema.prisma`)
2. Generate migrations (`npm run db:migrate`)
3. Update tRPC routers for new data models
4. Regenerate Prisma client (`npm run db:generate`)

### Type-Safe API Development
1. Define Zod schemas in tRPC routers
2. Implement server-side procedures
3. Use generated types in client components
4. Leverage React Query for data fetching

### Component Development
1. Create components in `src/components/ui/`
2. Follow shadcn/ui patterns for consistency
3. Use Tailwind for styling with design tokens
4. Import with clean aliases (`@/components/ui/...`)

## Testing & Quality Assurance

### Pre-Commit Workflow
Always run before committing:
```bash
npm run check           # Type checking + linting
npm run format          # Code formatting
npm run build           # Verify production build
```

### Type Safety Verification
- Use `npm run type-check` to verify TypeScript compilation
- ESLint catches common issues and enforces patterns
- tRPC provides runtime type validation

## Environment Configuration

Required environment variables:
```bash
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."  # For Prisma migrations

# Application
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Render Infrastructure

- **Render Workspace ID**: tea-d303qfodl3ps739p3e60
- PostgreSQL database with pgvector extension
- Next.js deployment with automatic builds
- Environment variable configuration for production