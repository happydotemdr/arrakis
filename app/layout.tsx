import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { TRPCProvider } from '@/components/providers/trpc-provider'
import { QueryProvider } from '@/components/providers/query-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Arrakis - Claude Code Conversation Capture',
  description:
    'Modern conversation capture and semantic search for Claude Code sessions',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>
          <TRPCProvider>{children}</TRPCProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
