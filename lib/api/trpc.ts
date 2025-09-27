/**
 * tRPC Setup and Configuration
 * Base tRPC configuration with context and middleware
 */

import { initTRPC, TRPCError } from '@trpc/server'
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import { ZodError } from 'zod'
import superjson from 'superjson'

/**
 * Create tRPC context
 * This is where you can add authentication, database connections, etc.
 */
export const createTRPCContext = (opts: FetchCreateContextFnOptions) => {
  return {
    // Add your context here
    // For now, we'll keep it simple
    user: null, // TODO: Add authentication
  }
}

type Context = Awaited<ReturnType<typeof createTRPCContext>>

/**
 * Initialize tRPC
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

/**
 * Public procedure
 * Available to all users
 */
export const publicProcedure = t.procedure

/**
 * Protected procedure
 * Requires authentication (TODO: implement auth middleware)
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  // For now, we'll skip authentication
  // In production, you'd check for valid session/token here
  return next({
    ctx: {
      ...ctx,
      // user: validated user object
    },
  })
})

/**
 * Create router
 */
export const router = t.router

/**
 * Middleware for logging
 */
export const loggerMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now()
  const result = await next()
  const duration = Date.now() - start

  if (process.env.NODE_ENV === 'development') {
    console.log(`tRPC ${type} ${path} - ${duration}ms`)
  }

  return result
})
