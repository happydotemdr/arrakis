# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

**Arrakis** has been completely reset to a minimal Hello World Express.js server. This is a fresh start from the ground up, having stripped away all previous complex architecture to return to bare bones.

**Current Status**: Minimal Express.js server with PostgreSQL database connectivity - ready for new development.

## Current State - September 29, 2025

This is a **minimal, clean-slate application** with:

### ✅ Simple Application Stack
- **Express.js 4.18** - Minimal web server
- **Node.js 18+** - JavaScript runtime
- **PostgreSQL** - Database connection via `pg` driver
- **Basic middleware** - CORS and JSON parsing

### ✅ Minimal Infrastructure (Render.com)
- **Single PostgreSQL database** - basic-256mb plan (~$7/month)
- **Single Node.js web service** - starter plan (~$5/month)
- **Total cost**: ~$12/month for minimal paid infrastructure

### ✅ Available Endpoints
- `GET /` - Hello World message with timestamp
- `GET /health` - Health check endpoint (required by Render)
- `GET /db-test` - Database connection test

## Development Commands

```bash
# Development
npm install              # Install minimal dependencies
npm start               # Start production server
npm run dev             # Start development server (same as start)

# Quality checks - inherited from parent directory
npm run check           # Full quality check (lint + format + type)
npm run format          # Auto-format all files
```

## File Structure

```
arrakis/
├── index.js            # Main Express server (Hello World)
├── package.json        # Minimal dependencies (express, cors, dotenv, pg)
├── render.yaml         # Minimal Render infrastructure
├── .env.example        # Database URL template
├── .env.local          # Local environment variables
├── .gitignore          # Basic Node.js gitignore
├── .claude/            # Claude Code configuration (preserved)
├── .github/            # GitHub workflows (preserved)
├── .vscode/            # VS Code settings (preserved)
└── README.md           # Project documentation
```

## Environment Setup

Required environment variables (`.env.local`):
```bash
# Database connection string (from Render PostgreSQL service)
DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"

# Application configuration
NODE_ENV="development"
PORT="3000"
```

## Render Infrastructure

### Minimal Configuration
- **Database**: `arrakis-prod-db` (basic-256mb, PostgreSQL 17)
- **Web Service**: `arrakis-prod` (starter plan, Node.js runtime)
- **Auto-deploy**: Disabled (manual deployments for safety)
- **Health check**: `/health` endpoint
- **Build**: `npm install`
- **Start**: `npm start`

### Removed Components
- All development environment services
- Redis/KeyValue stores
- Background workers
- Complex environment groups
- Framework-specific build processes

## Fresh Start Guidelines

### This is a Clean Slate
- **No legacy code** - All previous complex architecture removed
- **No dependencies on removed systems** - No tRPC, Drizzle, Next.js, etc.
- **Minimal dependencies** - Only express, cors, dotenv, pg
- **Ready for new development** - Build whatever you want from this foundation

### Development Approach
- **Start simple** - Add complexity only as needed
- **Database first** - PostgreSQL connection ready for your schema
- **Incremental growth** - Add features one at a time
- **Cost conscious** - Minimal infrastructure, scale up as needed

### Database Usage
- **Connection ready** - `/db-test` endpoint verifies connectivity
- **No existing schema** - Clean database, define your own tables
- **PostgreSQL 17** - Latest version with full feature set
- **SSL required** - Production security enabled

## Next Steps

This minimal foundation is ready for:
1. **Define your data model** - Create tables and schema
2. **Add business logic** - Build the features you actually need
3. **Implement authentication** - If/when users are needed
4. **Add frontend** - React, vanilla JS, or server-rendered pages
5. **Scale infrastructure** - Upgrade services as usage grows

## Important Notes

✅ **This IS a new project** - Complete reset, no legacy constraints
✅ **Clean foundation** - Minimal dependencies, maximum flexibility
✅ **Cost optimized** - Only essential paid services
✅ **Database ready** - PostgreSQL connection tested and working
✅ **Deployment ready** - Render configuration operational

Start building whatever you want - this is your clean foundation!