---
name: focus-backend
description: Load backend-specific context for API, database, and server-side development
---

# Backend Focus Mode

Switch context to backend development with APIs, database operations, and server logic.

## Context Loading

### 1. API Structure Analysis
- [ ] Review API routes in `src/app/api/`
- [ ] Identify tRPC routers and procedures
- [ ] Check endpoint organization and patterns
- [ ] Note authentication/authorization middleware

### 2. Database Context
- [ ] Load database schema from `prisma/schema.prisma`
- [ ] Review models, relations, and indexes
- [ ] Check migration files
- [ ] Identify Neon-specific configurations

### 3. Business Logic
- [ ] Review server-side utilities in `src/lib/`
- [ ] Identify service layers and business logic
- [ ] Check validation schemas (Zod)
- [ ] Note error handling patterns

### 4. External Integrations
- [ ] Review third-party API integrations
- [ ] Check environment variables in `.env.example`
- [ ] Identify external service configurations
- [ ] Note API keys and credentials management

### 5. Backend Dependencies
- [ ] Review `package.json` for backend libraries
- [ ] Check database client (Prisma, Drizzle)
- [ ] Note API framework (tRPC, Next.js API routes)
- [ ] Identify utility libraries (date-fns, etc.)

## Ready for Backend Work

With context loaded, you're ready for:
- ✅ Creating new API endpoints
- ✅ Implementing business logic
- ✅ Database schema design and migrations
- ✅ Query optimization
- ✅ Authentication and authorization
- ✅ Data validation and transformation
- ✅ Error handling
- ✅ Third-party integrations

## Common Backend Tasks

**API Development**
- Create tRPC procedures
- Define input/output schemas
- Implement CRUD operations
- Add middleware and guards

**Database Operations**
- Design schema changes
- Write migrations
- Optimize queries
- Add indexes
- Handle transactions

**Business Logic**
- Implement core features
- Add validation rules
- Handle edge cases
- Process data transformations

**Security**
- Implement authentication
- Add authorization checks
- Validate user input
- Sanitize data
- Handle secrets securely

**Performance**
- Optimize database queries
- Implement caching
- Add pagination
- Profile slow operations