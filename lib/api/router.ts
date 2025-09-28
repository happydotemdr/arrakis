/**
 * Main tRPC App Router
 * Combines all individual routers into the main app router
 */

import { router } from './trpc'
import { sessionsRouter } from './routers/sessions'
import { searchRouter } from './routers/search'
import { captureRouter } from './routers/capture'
import { claudeRouter } from './routers/claude'
import { claudeCodeRouter } from './routers/claude-code'
import { templatesRouter } from './routers/templates'

/**
 * Main application router
 *
 * Add new routers here as you create them
 */
export const appRouter = router({
  sessions: sessionsRouter,
  search: searchRouter,
  capture: captureRouter,
  claude: claudeRouter,
  claudeCode: claudeCodeRouter,
  templates: templatesRouter,
})

// Export type definition for client-side type safety
export type AppRouter = typeof appRouter
