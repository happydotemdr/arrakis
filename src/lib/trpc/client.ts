'use client'

import { createTRPCReact } from '@trpc/react-query'
import type { AppRouter } from '@/server/api/root'

/**
 * A set of type-safe React Query hooks for the tRPC client.
 *
 * @example
 * ```tsx
 * import { trpc } from '@/lib/trpc/client'
 *
 * function MyComponent() {
 *   const { data, isLoading } = trpc.conversation.list.useQuery()
 *   const mutation = trpc.conversation.capture.useMutation()
 * }
 * ```
 */
export const trpc = createTRPCReact<AppRouter>()