import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { TRPCReactProvider } from '@/lib/trpc/provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Arrakis - Conversation Persistence System',
  description: 'A Next.js application for managing persistent conversations with Claude',
  authors: [{ name: 'Arrakis Team' }],
  keywords: ['Next.js', 'React', 'TypeScript', 'tRPC', 'Prisma', 'Claude'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TRPCReactProvider>
          <div className="min-h-screen bg-background">
            <main>{children}</main>
          </div>
        </TRPCReactProvider>
      </body>
    </html>
  )
}