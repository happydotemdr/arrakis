# Arrakis - Claude Code Conversation Capture

A modern conversation capture and semantic search system for Claude Code
sessions with AI-powered insights and real-time collaboration features.

## 🚀 Production Ready - Phases 1 & 2 Complete + Schema Evolution ✅

**Current Status**: Fully functional conversation capture and web interface
system with evolved database schema

- ✅ **Phase 1 Complete** - Foundation and automatic capture system
- ✅ **Phase 2 Complete** - Full web interface with 54 React components
- ✅ **Schema Evolution** - Database recovery and alignment (Sept 27, 2025)
- 🚀 **Phase 3 Ready** - AI-powered insights and semantic search

## 🎯 What's Working Now

- **Automatic Capture**: Background service captures all Claude Code
  conversations
- **Modern Web Interface**: Next.js 15 app with responsive design and real-time
  dashboard
- **Session Management**: Browse, filter, and view conversations with full
  metadata
- **Search Foundation**: Text search with extensible architecture for semantic
  search
- **Production Build**: TypeScript compilation passing, ready for deployment
- **Database Recovery**: Successfully resolved schema misalignment with zero errors

## 🔧 Recent Major Work - September 27, 2025

**Schema Evolution & Recovery**: Successfully resolved post-GitHub database/code
misalignment through systematic schema evolution:

### Database Enhancements
- ✅ **Added `message_count`** to sessions table with automatic counting
- ✅ **Added `embedding_status`** to both sessions and messages tables
- ✅ **Updated existing data** - All 4 sessions now have correct message counts
- ✅ **Preserved data integrity** - No data loss during schema evolution

### Code Synchronization
- ✅ **Fixed 20+ TypeScript errors** across core search and context files
- ✅ **Updated Drizzle schema** to match evolved database structure
- ✅ **Synchronized field references** (`timestamp` → `createdAt`, etc.)
- ✅ **Added missing imports** (`sql` import in context-retrieval.ts)

### Quality Verification
- ✅ **Zero TypeScript compilation errors** - Clean builds achieved
- ✅ **Successful production builds** - All 10 pages optimized
- ✅ **Database verification** - Real queries working with live data
- ✅ **Schema alignment** - Code expectations match database reality

## Quick Start

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build

# Run linting
bun run lint

# Type check
bun run type-check
```

## Project Structure

```
arrakis/
├── app/                 # Next.js App Router (54 React components)
│   ├── (dashboard)/    # Dashboard layout with sidebar navigation
│   ├── api/           # tRPC API endpoints
│   └── globals.css    # Global styles
├── components/          # React components (organized by feature)
│   ├── ui/             # shadcn/ui components
│   ├── dashboard/      # Dashboard-specific components
│   ├── sessions/       # Session management components
│   ├── search/         # Search interface components
│   └── capture/        # Capture service components
├── lib/                # Core libraries
│   ├── db/            # Drizzle ORM schema & queries
│   ├── capture/       # Automatic conversation capture
│   ├── api/           # tRPC routers (sessions, search, capture)
│   └── utils.ts       # Utility functions
├── types/              # TypeScript definitions
├── scripts/            # Database and utility scripts
└── docs/               # Implementation plans and documentation
```

## Development Status

**Phase 1 & 2 Complete** ✅ - Ready for Phase 3 advanced features

### ✅ Phase 1 Completed (Foundation)

- [x] Next.js 15 + TypeScript + React 19
- [x] Neon PostgreSQL database with pgvector
- [x] Drizzle ORM with complete schema
- [x] Automatic Claude Code conversation capture
- [x] Real-time proxy injection system
- [x] Rich metadata extraction and storage

### ✅ Phase 2 Completed (Web Interface)

- [x] Modern responsive web application
- [x] 54 React components with Tailwind CSS + shadcn/ui
- [x] tRPC API layer with type safety
- [x] Real-time dashboard with capture monitoring
- [x] Session browsing with pagination and filtering
- [x] Basic search functionality
- [x] Production build optimization

### 🚀 Phase 3 Ready (Advanced Features)

- [ ] AI-powered semantic search with vector embeddings
- [ ] Conversation insights and analysis
- [ ] Multi-user collaboration features
- [ ] Public API and integrations
- [ ] Performance optimization and monitoring

See the [Phase 3 Implementation Plan](docs/phase-3-implementation-plan.md) for
the next development phase.

## Environment Setup

Copy `.env.example` to `.env.local` and configure:

- `DATABASE_URL` - Neon PostgreSQL connection
- `OPENAI_API_KEY` - For text embeddings
- `REDIS_URL` - For job queue (optional in dev)

## Tech Stack

### Core Technologies ✅ Implemented

- **Framework**: Next.js 15 with App Router and React 19
- **Runtime**: Bun runtime for fast development and builds
- **Language**: TypeScript 5.9 with strict type checking
- **Styling**: Tailwind CSS + shadcn/ui component library
- **Database**: Neon PostgreSQL with pgvector extension
- **ORM**: Drizzle ORM with type-safe queries
- **API Layer**: tRPC v11.6 for end-to-end type safety

### Additional Features ✅ Operational

- **State Management**: TanStack Query for server state
- **Build System**: Optimized production builds
- **Capture System**: Automatic Claude Code proxy injection
- **UI Components**: 54 responsive React components
- **Real-time Features**: Live capture monitoring dashboard

## Documentation

- **[Phase 1 Plan](docs/phase-1-implementation-plan.md)** - Foundation setup (✅
  Complete)
- **[Phase 2 Plan](docs/phase-2-implementation-plan.md)** - Web interface (✅
  Complete)
- **[Phase 3 Plan](docs/phase-3-implementation-plan.md)** - Advanced features
  (📋 Ready)
- **[Future Enhancements](docs/future-enhancements.md)** - Long-term roadmap
