/**
 * tRPC API Route Handler
 * Handles all tRPC requests in the Next.js App Router
 */

import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/lib/api/router'
import { createTRPCContext } from '@/lib/api/trpc'

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: createTRPCContext,
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`
            )
          }
        : undefined,
  })

export { handler as GET, handler as POST }
