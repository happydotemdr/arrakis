# Arrakis Project Context

**Last Updated**: 2025-09-29

## Project Overview

**Arrakis** is a modern conversation persistence system built with Next.js 15 for
capturing and managing Claude Code conversations with semantic search
capabilities.

## Technology Stack

### Frontend

- **Next.js**: 15.5.4 (App Router)
- **React**: 19.1.1 (latest with new features)
- **TypeScript**: 5.9.2 (strict mode enabled)
- **Tailwind CSS**: 3.4.0 (with shadcn/ui components)

### Backend

- **tRPC**: 11.6.0 (end-to-end type-safe APIs)
- **Prisma**: 6.16.2 (ORM with migrations)
- **Zod**: 3.23.8 (runtime validation)
- **@tanstack/react-query**: 5.90.2 (data fetching)

### Database

- **PostgreSQL**: 17 (hosted on Render)
- **pgvector**: Vector extension for semantic search
- **Database Name**: `arrakis_production_bq3v`
- **User**: `arrakis_prod_user`

### AI Integration

- **OpenAI SDK**: 5.23.1 (for embeddings and AI features)
- **Embeddings**: text-embedding-3-small (1536 dimensions)

## Project Structure

```
arrakis/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/trpc/[trpc]/     # tRPC API routes
│   │   ├── conversations/       # Conversation pages
│   │   └── page.tsx             # Home page
│   ├── components/
│   │   └── ui/                  # shadcn/ui components
│   ├── lib/
│   │   ├── trpc/                # tRPC client/server setup
│   │   ├── claude/              # Claude-specific utilities
│   │   ├── db.ts                # Prisma client
│   │   └── vector-operations.ts # Vector search utilities
│   ├── server/
│   │   └── api/
│   │       ├── routers/         # tRPC routers
│   │       ├── trpc.ts          # tRPC config
│   │       └── root.ts          # Root router
│   └── types/                   # TypeScript definitions
├── prisma/
│   ├── schema.prisma            # Database schema
│   └── seed.ts                  # Seed data
└── .claude/                     # Claude Code configuration
    ├── settings.json            # User settings
    ├── hooks/                   # Git hooks & formatters
    ├── commands/                # Custom commands
    ├── agents/                  # Specialized agents
    └── memories/                # Context files (this directory)
```

## Code Quality Tools

### Formatters & Linters

- **Biome**: Fast formatter/linter for JS/TS/JSON/CSS
- **Prettier**: Markdown formatting only
- **markdownlint**: Markdown structural validation
- **ESLint**: Next.js ESLint config

### Pre-approved Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run check        # Type-check + lint (run before commits!)
npm run format       # Auto-format all files
npm run lint:fix     # Auto-fix linting issues
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:studio    # Open Prisma Studio
```

## Development Workflow

1. **Database changes** → Modify `prisma/schema.prisma`
2. **Run migrations** → `npm run db:push` or `npm run db:migrate`
3. **Type-safe APIs** → Define tRPC procedures in `src/server/api/routers/`
4. **UI components** → Build with React 19 + Tailwind + shadcn/ui
5. **Format & check** → Run `npm run check` before committing

## Key Features

### Current Implementation

- ✅ Conversation management (CRUD operations)
- ✅ Message storage with role categorization
- ✅ Tool usage tracking (tool calls, responses, duration)
- ✅ Vector embeddings for semantic search
- ✅ PostgreSQL with pgvector extension
- ✅ tRPC API layer with full type safety
- ✅ Prisma ORM with migrations

### Planned Features (from ROADMAP)

- ⏳ Epic-level roadmap planning
- ⏳ Drag-and-drop reordering
- ⏳ Status/priority tracking
- ⏳ 1990's sci-fi aesthetic
- ⏳ Quarterly planning view

## Environment Variables

### Required Variables

```env
DATABASE_URL="postgresql://..."  # Primary connection string
DIRECT_URL="postgresql://..."    # Direct URL for migrations
NODE_ENV="development|production"
NEXTAUTH_SECRET="..."            # For future auth
NEXTAUTH_URL="http://localhost:3000"
OPENAI_API_KEY="..."             # For AI features
```

## Important Notes

- **Auto-deploy disabled** on Render (manual deployments for safety)
- **Strict TypeScript** mode enabled throughout
- **Line width**: 80 characters for all code and markdown
- **Git hooks** automatically format code before commits
- **VS Code** configured with Biome + Prettier extensions