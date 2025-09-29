# Arrakis - Conversation Persistence System

A modern Next.js 15.5.4 application for persistent conversation management built with React 19, TypeScript, tRPC, and Prisma.

## 🚀 Fresh Next.js 15 Setup - September 29, 2025

**Current Status**: Complete modern Next.js application with conversation persistence architecture

- ✅ **Next.js 15.5.4** - Latest version with App Router
- ✅ **React 19.1.1** - Latest React with new features
- ✅ **TypeScript 5.9.2** - Full type safety throughout
- ✅ **tRPC 11.6.0** - End-to-end type-safe APIs
- ✅ **Prisma 6.16.2** - Modern database ORM with migrations

## 🎯 What You Get

- **Modern Architecture**: Next.js 15 with App Router, React 19, TypeScript 5.9
- **Type-Safe APIs**: tRPC for end-to-end type safety from database to frontend
- **Database Ready**: Prisma ORM with PostgreSQL schema for conversations and messages
- **UI Components**: Tailwind CSS with shadcn/ui components for consistent design
- **Development Tools**: ESLint, Prettier, and TypeScript for code quality

## 🏗️ Architecture

### Technology Stack
- **Frontend**: Next.js 15.5.4 with React 19.1.1 and TypeScript 5.9.2
- **API Layer**: tRPC 11.6.0 with @tanstack/react-query 5.90.2
- **Database**: PostgreSQL with Prisma ORM 6.16.2
- **Styling**: Tailwind CSS with shadcn/ui components
- **AI Integration**: OpenAI SDK 5.23.1 for future AI features
- **Validation**: Zod 4.1.11 for runtime type checking

### Database Schema
```sql
-- Conversations table
model Conversation {
  id          String   @id @default(cuid())
  title       String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  messages    Message[]
}

-- Messages table
model Message {
  id             String   @id @default(cuid())
  conversationId String
  role           Role     // user | assistant | system
  content        String
  metadata       Json?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment
```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your database URL
# DATABASE_URL="postgresql://username:password@host:port/database?sslmode=require"
```

### 3. Set Up Database
```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Optional: Seed with sample data
npm run db:seed
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Available Scripts
```bash
npm run dev         # Start development server
npm run build       # Build for production
npm run start       # Start production server
npm run lint        # Run ESLint (using v9 flat config)
npm run lint:fix    # Run ESLint and auto-fix issues
npm run type-check  # TypeScript type checking
npm run db:studio   # Open Prisma Studio
npm run format      # Format code with Prettier
npm run check       # Run type-check and lint
```

## Project Structure

```
arrakis/
├── src/
│   ├── app/                    # Next.js 15 App Router
│   │   ├── api/trpc/[trpc]/   # tRPC API routes
│   │   ├── conversations/     # Conversations pages
│   │   ├── globals.css        # Global Tailwind styles
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Home page
│   ├── components/
│   │   └── ui/               # shadcn/ui components
│   ├── lib/
│   │   ├── trpc/             # tRPC client and server setup
│   │   ├── db.ts             # Prisma client
│   │   └── utils.ts          # Utility functions
│   ├── server/
│   │   └── api/              # tRPC server routes
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Shared utilities
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── seed.ts               # Database seeding
├── package.json              # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── tailwind.config.ts       # Tailwind CSS configuration
├── next.config.js           # Next.js configuration
└── .env.example             # Environment variables template
```

## Features

### Core Functionality
- ✅ **Conversation Management** - Create, read, update, and delete conversations
- ✅ **Message Storage** - Store messages with role-based categorization (user/assistant/system)
- ✅ **Metadata Support** - Flexible JSON metadata for extended message context
- ✅ **Type Safety** - Full TypeScript coverage from database to frontend
- ✅ **Real-time Updates** - Powered by tRPC and React Query

### Technical Features
- ✅ **Modern React** - React 19 with latest features and optimizations
- ✅ **App Router** - Next.js 15 App Router for optimal performance
- ✅ **API Layer** - tRPC for type-safe client-server communication
- ✅ **Database ORM** - Prisma with PostgreSQL for robust data management
- ✅ **UI Components** - Tailwind CSS + shadcn/ui for consistent design
- ✅ **Development Tools** - ESLint 9 (flat config), Prettier, TypeScript for code quality

## Development

### Prerequisites
- Node.js 18+ (preferably 20+)
- PostgreSQL database (local or hosted)
- npm/yarn/pnpm package manager

### Development Workflow
1. **Database First** - Schema changes go through Prisma migrations
2. **Type-Safe APIs** - tRPC ensures end-to-end type safety
3. **Component-Driven** - UI built with reusable shadcn/ui components
4. **Code Quality** - Automated formatting and linting

### Deployment
Ready for deployment to platforms like:
- **Vercel** - Optimized for Next.js applications
- **Render** - Easy PostgreSQL + Node.js hosting
- **Railway** - Simple full-stack deployment
- **Netlify** - Static and serverless functions

## Next Steps

1. **Set up your database** - Configure PostgreSQL connection
2. **Run initial setup** - Install dependencies and run migrations
3. **Start building** - Add your conversation features
4. **Customize UI** - Modify components to match your design
5. **Add features** - Extend with search, AI integration, or collaboration tools

## License

This project is ready for your use - build something amazing!
